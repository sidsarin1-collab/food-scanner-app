export const PHOTO_TIMEOUT_MS = 45_000;
export const PHOTO_TIMEOUT_MESSAGE =
  "Reading the photo is taking too long. Please try again, or paste the ingredient text instead.";

const PASTE_HINT = ", or paste the ingredient text instead.";

type Kind = "photo" | "score";

/** Server-written messages are short and friendly; anything else (HTML, stack traces, huge text) is ignored. */
function usableServerMessage(body: unknown): string | null {
  const msg = (body as { error?: unknown } | null)?.error;
  return typeof msg === "string" && msg.trim() && msg.length <= 300 ? msg.trim() : null;
}

/** Clear message for a reply that wasn't OK. Works even when the reply isn't JSON (e.g. a proxy's plain-text 502). */
export function messageForFailedResponse(kind: Kind, status: number, body: unknown): string {
  const server = usableServerMessage(body);
  if (kind === "photo") {
    if (status === 413) return "That photo is too large (max 10MB). Try a smaller photo, or paste the ingredient text instead.";
    if (status === 504) return PHOTO_TIMEOUT_MESSAGE;
    if (status === 429) return server ?? `You're uploading photos too quickly. Please wait a few minutes${PASTE_HINT}`;
    if (status === 503) return server ?? "Photo scanning is busy right now, paste the ingredient text instead.";
    if ((status === 400 || status === 422) && server) return server;
    return `Something went wrong reading that photo. Please try again${PASTE_HINT}`;
  }
  if (status === 413) return "That ingredient list is too large. Please shorten it and try again.";
  if (status === 429) return server ?? "You're scanning very fast. Please wait a few minutes and try again.";
  if (status === 503) return server ?? "The scanner is very busy right now. Please try again in a few minutes.";
  if (status === 400 && server) return server;
  return "Something went wrong on our end. Please try again in a moment.";
}

/** Clear message when the request never got an answer (no signal, dropped connection, our own timeout). */
export function messageForNetworkFailure(kind: Kind, err: unknown): string {
  if ((err as { name?: string } | null)?.name === "AbortError") return PHOTO_TIMEOUT_MESSAGE;
  return kind === "photo"
    ? `Couldn't reach the server. Please check your connection and try again${PASTE_HINT}`
    : "Couldn't reach the server. Please check your connection and try again.";
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Sends a photo. Always settles: success, a clear failure message, or a 45-second timeout. */
export async function submitPhoto(
  file: File,
  fetchImpl: FetchLike = (url, init) => fetch(url, init),
  timeoutMs: number = PHOTO_TIMEOUT_MS
): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const formData = new FormData();
    formData.append("photo", file);
    const res = await fetchImpl("/api/scan-photo", { method: "POST", body: formData, signal: controller.signal });
    const body = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, message: messageForFailedResponse("photo", res.status, body) };
    const text = (body as { ingredientText?: unknown } | null)?.ingredientText;
    if (typeof text !== "string" || !text.trim()) {
      return { ok: false, message: messageForFailedResponse("photo", 500, null) };
    }
    return { ok: true, text };
  } catch (err) {
    return { ok: false, message: messageForNetworkFailure("photo", err) };
  } finally {
    clearTimeout(timer);
  }
}

/** Sends an ingredient list for scoring. Always settles with data or a clear failure message. */
export async function submitScore<T>(
  payload: unknown,
  fetchImpl: FetchLike = (url, init) => fetch(url, init)
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const res = await fetchImpl("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, message: messageForFailedResponse("score", res.status, body) };
    if (!body || typeof body !== "object") return { ok: false, message: messageForFailedResponse("score", 500, null) };
    return { ok: true, data: body as T };
  } catch (err) {
    return { ok: false, message: messageForNetworkFailure("score", err) };
  }
}
