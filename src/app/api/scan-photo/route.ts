import { NextResponse } from "next/server";
import { extractIngredientsFromImage } from "@/lib/claudeVision";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export async function POST(req: Request) {
  const formData = await req.formData().catch(() => null);
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
