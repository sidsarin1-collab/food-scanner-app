import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-5";

const EXTRACTION_PROMPT = `This is a photo of a food product's ingredient panel. Read the ingredient list exactly as printed and return ONLY the ingredients as a plain comma-separated list, in the same order as printed -- no headings, no commentary, no markdown.

If you cannot find or clearly read an ingredient list in this image, respond with exactly: NO_INGREDIENTS_FOUND`;

export type ExtractionResult =
  | { ok: true; text: string }
  | { ok: false; reason: "not_found" | "api_error" };

export async function extractIngredientsFromImage(
  base64Data: string,
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp"
): Promise<ExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64Data },
            },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const text = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";

    if (!text || text === "NO_INGREDIENTS_FOUND") {
      return { ok: false, reason: "not_found" };
    }
    return { ok: true, text };
  } catch (err) {
    console.error("Claude vision extraction failed:", err);
    return { ok: false, reason: "api_error" };
  }
}
