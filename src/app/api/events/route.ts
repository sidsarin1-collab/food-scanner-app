import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import geoip from "geoip-lite";
import { prisma } from "@/lib/db";

const ALLOWED_ACTIONS = new Set(["viewed", "clicked_alternative", "dismissed"]);

/** Country + city, derived in-memory from the request IP -- the IP itself is
 * never logged or stored anywhere, only these resolved results. Railway
 * (like most PaaS) sits behind a proxy, so the real client IP is in
 * x-forwarded-for, not the raw connection address. City coverage in the free
 * geoip-lite dataset is notably weaker than country -- null is expected and
 * common (VPNs, mobile carriers, many residential IPs), not a bug. */
function detectLocationFromRequest(req: Request): { country: string | null; city: string | null } {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : null;
  if (!ip) return { country: null, city: null };
  const result = geoip.lookup(ip);
  return { country: result?.country ?? null, city: result?.city || null };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
  const action = typeof body?.action === "string" ? body.action : "";
  if (!sessionId || !ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const ingredientList = typeof body?.ingredientList === "string" ? body.ingredientList : "";
  const verdictShown = typeof body?.verdictShown === "string" ? body.verdictShown : null;
  const country = typeof body?.country === "string" && body.country.trim() ? body.country.trim() : null;

  // Never store the free-text name/ingredient list itself in analytics -- only
  // an identifiable product name (if the user gave one) or a one-way hash.
  let productScanned: string | null = null;
  if (name && name !== "Untitled product") {
    productScanned = name;
  } else if (ingredientList) {
    productScanned = createHash("sha256").update(ingredientList).digest("hex").slice(0, 16);
  }

  const { country: detectedCountry, city: detectedCity } = detectLocationFromRequest(req);

  await prisma.event.create({
    data: { sessionId, action, productScanned, verdictShown, country, detectedCountry, detectedCity },
  });

  return NextResponse.json({ ok: true });
}
