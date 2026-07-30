const SESSION_COOKIE = "scanner_session";
const NOTICE_ACK_KEY = "scanner_analytics_notice_ack";
const COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export function hasAcknowledgedNotice(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(NOTICE_ACK_KEY) === "true";
}

export function acknowledgeNotice(): void {
  window.localStorage.setItem(NOTICE_ACK_KEY, "true");
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Returns the anonymous session id, creating one only if the tracking notice
 * has already been acknowledged. Returns null if it hasn't -- callers must
 * treat that as "do not track". */
function getOrCreateSessionId(): string | null {
  if (!hasAcknowledgedNotice()) return null;

  let id = readCookie(SESSION_COOKIE);
  if (!id) {
    id = crypto.randomUUID();
    document.cookie = `${SESSION_COOKIE}=${id}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  }
  return id;
}

export type TrackAction = "viewed" | "clicked_alternative" | "dismissed";

export async function trackEvent(params: {
  action: TrackAction;
  name?: string;
  ingredientList?: string;
  verdictShown?: string;
  country?: string;
}): Promise<void> {
  const sessionId = getOrCreateSessionId();
  if (!sessionId) return; // notice not yet acknowledged -- no tracking

  try {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, ...params }),
    });
  } catch {
    // Tracking must never break the actual feature.
  }
}
