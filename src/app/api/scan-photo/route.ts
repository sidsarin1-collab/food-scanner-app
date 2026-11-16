import { NextResponse } from "next/server";
import { extractIngredientsFromImage } from "@/lib/claudeVision";
import { checkRateLimit, rateLimitedResponse, takePhotoScanSlot, PHOTO_BUSY_MESSAGE } from "@/lib/rateLimit";
import { readBodyWithLimit, PHOTO_MAX_BYTES, PHOTO_BODY_MAX_BYTES, PHOTO_DRAIN_BYTES } from "@/lib/requestLimits";

const MAX_FILE_BYTES = PHOTO_MAX_BYTES; // 10MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export async function POST(req: Request) {
  const limit = checkRateLimit("photo", req);
  if (!limit.ok) return rateLimitedResponse("photo", limit);

  // Count the bytes that actually arrive instead of trusting the declared size,
  // and stop reading as soon as the limit is passed.
  const body = await readBodyWithLimit(req, PHOTO_BODY_MAX_BYTES, PHOTO_DRAIN_BYTES);
  if (!body.ok) {
    return NextResponse.json(
      { error: "Photo is too large (max 10MB)" },
      { status: 413, headers: body.fullyRead ? undefined : { Connection: "close" } }
    );
  }
  const formData = await new Response(body.bytes, {
    headers: { "content-type": req.headers.get("content-type") ?? "" },
  })
    .formData()
    .catch(() => null);
  const file = formData?.get("photo");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No photo uploaded" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported image type -- use JPEG, PNG, WEBP, or GIF" },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Photo is too large (max 10MB)" }, { status: 400 });
  }

  if (!takePhotoScanSlot()) {
    return NextResponse.json({ error: PHOTO_BUSY_MESSAGE }, { status: 503 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64Data = buffer.toString("base64");

  const result = await extractIngredientsFromImage(
    base64Data,
    file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp"
  );

  if (!result.ok) {
    const message =
      result.reason === "not_found"
        ? "Couldn't find a readable ingredient list in that photo. Try a clearer, closer photo, or type the ingredients manually."
        : "Something went wrong reading the photo. Please try again.";
    return NextResponse.json({ error: message }, { status: result.reason === "not_found" ? 422 : 502 });
  }

  return NextResponse.json({ ingredientText: result.text });
}
