import { NextResponse } from "next/server";
import { extractIngredientsFromImage } from "@/lib/claudeVision";
import { checkRateLimit, rateLimitedResponse, takePhotoScanSlot, PHOTO_BUSY_MESSAGE } from "@/lib/rateLimit";
import { readBodyWithLimit, PHOTO_MAX_BYTES, PHOTO_BODY_MAX_BYTES, PHOTO_DRAIN_BYTES } from "@/lib/requestLimits";
import { PHOTO_TIMEOUT_MESSAGE } from "@/lib/clientErrors";

const MAX_FILE_BYTES = PHOTO_MAX_BYTES; // 10MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

type Outcome = { res: NextResponse; result: string; sizeBytes: number | null };

function fail(result: string, sizeBytes: number | null, error: string, status: number, headers?: Record<string, string>): Outcome {
  return { res: NextResponse.json({ error }, { status, headers }), result, sizeBytes };
}

async function handlePhoto(req: Request): Promise<Outcome> {
  const limit = checkRateLimit("photo", req);
  if (!limit.ok) {
    return { res: rateLimitedResponse("photo", limit), result: limit.scope === "site" ? "busy_site_limit" : "rate_limited", sizeBytes: null };
  }

  // Count the bytes that actually arrive instead of trusting the declared size,
  // and stop reading as soon as the limit is passed.
  let body;
  try {
    body = await readBodyWithLimit(req, PHOTO_BODY_MAX_BYTES, PHOTO_DRAIN_BYTES);
  } catch {
    return fail("upload_interrupted", null, "The photo upload was interrupted. Please try again, or paste the ingredient text instead.", 400);
  }
  if (!body.ok) {
    return fail("too_large", body.receivedBytes, "Photo is too large (max 10MB)", 413, body.fullyRead ? undefined : { Connection: "close" });
  }
  const formData = await new Response(body.bytes, {
    headers: { "content-type": req.headers.get("content-type") ?? "" },
  })
    .formData()
    .catch(() => null);
  const file = formData?.get("photo");

  if (!file || !(file instanceof File)) {
    return fail("no_photo", body.bytes.length, "No photo uploaded", 400);
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return fail("unsupported_type", file.size, "Unsupported image type -- use JPEG, PNG, WEBP, or GIF", 400);
  }
  if (file.size > MAX_FILE_BYTES) {
    return fail("too_large", file.size, "Photo is too large (max 10MB)", 400);
  }

  if (!takePhotoScanSlot()) {
    return fail("daily_cap", file.size, PHOTO_BUSY_MESSAGE, 503);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64Data = buffer.toString("base64");

  const result = await extractIngredientsFromImage(
    base64Data,
    file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp"
  );

  if (!result.ok) {
    if (result.reason === "not_found") {
      return fail(
        "not_found",
        file.size,
        "Couldn't find a readable ingredient list in that photo. Try a clearer, closer photo, or type the ingredients manually.",
        422
      );
    }
    if (result.reason === "timeout") {
      return fail("timeout", file.size, PHOTO_TIMEOUT_MESSAGE, 504);
    }
    return fail("api_error", file.size, "Something went wrong reading the photo. Please try again.", 502);
  }

  return { res: NextResponse.json({ ingredientText: result.text }), result: "success", sizeBytes: file.size };
}

export async function POST(req: Request) {
  const started = Date.now();
  let outcome: Outcome;
  try {
    outcome = await handlePhoto(req);
  } catch (err) {
    console.error("Photo scan failed unexpectedly:", err);
    outcome = fail("server_error", null, "Something went wrong reading the photo. Please try again, or paste the ingredient text instead.", 500);
  }
  // One line per photo scan: result, size and time only -- never photo content or IP addresses.
  console.log(
    `[photo-scan] result=${outcome.result} sizeBytes=${outcome.sizeBytes ?? "unknown"} durationMs=${Date.now() - started} status=${outcome.res.status}`
  );
  return outcome.res;
}
