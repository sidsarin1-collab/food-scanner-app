import { isIP } from "node:net";
import { NextResponse } from "next/server";

// In-memory limits for one server: counts reset on restart/deploy and are not
// shared between servers. Optional switches (read fresh from the environment):
//   RATE_LIMITS_ENABLED=false  -> per-IP and site-wide request limits off (size limits and the photo daily cap stay on)
//   PHOTO_SCAN_DAILY_CAP=<n>   -> max photo reads per UTC day across everyone (default 200)

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const RULES = {
  photo: { perIp: 10, ipWindowMs: HOUR, siteLimit: 100, siteWindowMs: HOUR },
  score: { perIp: 30, ipWindowMs: 10 * MINUTE, siteLimit: 600, siteWindowMs: HOUR },
  events: { perIp: 120, ipWindowMs: 10 * MINUTE, siteLimit: 1800, siteWindowMs: HOUR },
} as const;

export type LimitedRoute = keyof typeof RULES;
export type LimitBlocked = { ok: false; scope: "ip" | "site"; retryAfterSeconds: number };
export type LimitResult = { ok: true } | LimitBlocked;

// If we can't tell who a visitor is, they must never share one bucket at the
// normal per-IP limit (that would lock out real people), so they get this much more room.
const UNKNOWN_IP_MULTIPLIER = 10;

export const PHOTO_BUSY_MESSAGE = "Photo scanning is busy right now, paste the ingredient text instead.";

type Counter = { count: number; resetAt: number; logged: boolean };
const counters = new Map<string, Counter>();
let lastPrune = 0;

function isPrivateOrLocal(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const lower = ip.toLowerCase();
  return lower === "::1" || lower === "::" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80");
}

/** Real visitor IP, or null if it can't be determined (missing, malformed, or an internal proxy address). */
export function getClientIp(req: Request): string | null {
  const candidates: string[] = [];
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) candidates.push(cf);
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // The last entry is the one added by the nearest proxy; earlier entries can be written by the visitor.
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length) candidates.push(parts[parts.length - 1]);
  }
  for (const ip of candidates) {
    if (isIP(ip) && !isPrivateOrLocal(ip)) return ip;
  }
  return null;
}

function limitsEnabled(): boolean {
  const value = (process.env.RATE_LIMITS_ENABLED ?? "").trim().toLowerCase();
  return !["false", "0", "off", "no"].includes(value);
}

function prune(now: number) {
  if (now - lastPrune < MINUTE) return;
  lastPrune = now;
  for (const [key, c] of counters) if (c.resetAt <= now) counters.delete(key);
}

function currentCounter(key: string, windowMs: number, now: number): Counter {
  const c = counters.get(key);
  return c && c.resetAt > now ? c : { count: 0, resetAt: now + windowMs, logged: false };
}

/** Checks the per-IP and site-wide limits for a route and, if both allow it, counts the request. */
export function checkRateLimit(route: LimitedRoute, req: Request, now: number = Date.now()): LimitResult {
  if (!limitsEnabled()) return { ok: true };
  prune(now);

  const rule = RULES[route];
  const ip = getClientIp(req);
  const ipLimit = ip ? rule.perIp : rule.perIp * UNKNOWN_IP_MULTIPLIER;
  const siteKey = `${route}:site`;
  const ipKey = `${route}:ip:${ip ?? "unknown"}`;
  const site = currentCounter(siteKey, rule.siteWindowMs, now);
  const perIp = currentCounter(ipKey, rule.ipWindowMs, now);

  // Blocked requests are not counted, so refused traffic can't use up the shared allowance or grow memory.
  if (site.count >= rule.siteLimit) {
    if (!site.logged) {
      site.logged = true;
      counters.set(siteKey, site);
      console.warn(`[rate-limit] Site-wide hourly ceiling of ${rule.siteLimit} reached for ${route}; refusing requests until the hour resets.`);
    }
    return { ok: false, scope: "site", retryAfterSeconds: Math.ceil((site.resetAt - now) / 1000) };
  }
  if (perIp.count >= ipLimit) {
    return { ok: false, scope: "ip", retryAfterSeconds: Math.ceil((perIp.resetAt - now) / 1000) };
  }

  site.count++;
  perIp.count++;
  counters.set(siteKey, site);
  counters.set(ipKey, perIp);
  return { ok: true };
}

function waitText(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

export function rateLimitedResponse(route: LimitedRoute, blocked: LimitBlocked): NextResponse {
  const wait = waitText(blocked.retryAfterSeconds);
  let message: string;
  if (route === "photo") {
    message =
      blocked.scope === "site"
        ? PHOTO_BUSY_MESSAGE
        : `Too many photos from your connection. Please wait about ${wait} and try again, or paste the ingredient text instead.`;
  } else if (route === "score") {
    message =
      blocked.scope === "site"
        ? `The scanner is very busy right now. Please try again in about ${wait}.`
        : `You're scanning very fast. Please wait about ${wait} and try again.`;
  } else {
    message = "Too many requests.";
  }
  return NextResponse.json(
    { error: message, retryAfterSeconds: blocked.retryAfterSeconds },
    { status: blocked.scope === "site" ? 503 : 429, headers: { "Retry-After": String(blocked.retryAfterSeconds) } }
  );
}

const photoDaily = { day: "", count: 0, logged: false };

/** Every photo sent to Claude must take a slot first; false means the site-wide daily cap is reached. */
export function takePhotoScanSlot(now: Date = new Date()): boolean {
  const day = now.toISOString().slice(0, 10);
  if (photoDaily.day !== day) {
    photoDaily.day = day;
    photoDaily.count = 0;
    photoDaily.logged = false;
  }
  const n = Number.parseInt(process.env.PHOTO_SCAN_DAILY_CAP ?? "", 10);
  const cap = Number.isFinite(n) && n >= 0 ? n : 200;
  if (photoDaily.count >= cap) {
    if (!photoDaily.logged) {
      photoDaily.logged = true;
      console.warn(`[photo-scan] Daily cap of ${cap} photo reads reached for ${day} (UTC); photo scanning paused until tomorrow.`);
    }
    return false;
  }
  photoDaily.count++;
  return true;
}

export function resetRateLimitsForTests() {
  counters.clear();
  lastPrune = 0;
  photoDaily.day = "";
  photoDaily.count = 0;
  photoDaily.logged = false;
}
