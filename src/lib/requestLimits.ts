export const TEXT_LIMITS = {
  ingredientList: 5000,
  name: 100,
  brand: 100,
  country: 60,
  sessionId: 64,
  eventName: 120,
  verdict: 20,
} as const;

export const JSON_BODY_MAX_BYTES = 40 * 1024;
// A bit more than the limit is read and thrown away so a normal visitor gets a clear message.
export const JSON_BODY_DRAIN_BYTES = 1024 * 1024;
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
// Room for the multipart wrapper around the photo itself.
export const PHOTO_BODY_MAX_BYTES = PHOTO_MAX_BYTES + 64 * 1024;
export const PHOTO_DRAIN_BYTES = 20 * 1024 * 1024;

export type BodyResult =
  | { ok: true; bytes: Uint8Array<ArrayBuffer> }
  | { ok: false; fullyRead: boolean; receivedBytes: number };

/**
 * Reads a request body, counting the bytes that actually arrive (never the declared size).
 * Past `maxBytes` nothing more is kept in memory. Up to `drainExtraBytes` beyond that is
 * read and discarded so the visitor gets a proper error reply; anything bigger is
 * abandoned at once (fullyRead = false -> the caller should answer "Connection: close").
 * Deliberately no reader.cancel(): cancelling a body that is still being pulled makes
 * Node's built-in fetch code throw an uncaught error.
 */
export async function readBodyWithLimit(req: Request, maxBytes: number, drainExtraBytes = 0): Promise<BodyResult> {
  if (!req.body) return { ok: true, bytes: new Uint8Array(0) };
  const reader = req.body.getReader();
  let chunks: Uint8Array[] = [];
  let total = 0;
  let tooLarge = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes + drainExtraBytes) return { ok: false, fullyRead: false, receivedBytes: total };
    if (total > maxBytes) {
      tooLarge = true;
      chunks = [];
      continue;
    }
    chunks.push(value);
  }
  if (tooLarge) return { ok: false, fullyRead: true, receivedBytes: total };
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}

/** JSON body with an actual-bytes size limit. `body` is null when the JSON is missing or invalid. */
export async function readJsonWithLimit(
  req: Request,
  maxBytes: number = JSON_BODY_MAX_BYTES
): Promise<{ tooLarge: true; fullyRead: boolean } | { tooLarge: false; body: any }> {
  const result = await readBodyWithLimit(req, maxBytes, JSON_BODY_DRAIN_BYTES);
  if (!result.ok) return { tooLarge: true, fullyRead: result.fullyRead };
  try {
    return { tooLarge: false, body: JSON.parse(new TextDecoder().decode(result.bytes)) };
  } catch {
    return { tooLarge: false, body: null };
  }
}

export function tooLong(value: unknown, max: number): boolean {
  return typeof value === "string" && value.trim().length > max;
}
