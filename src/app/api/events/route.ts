import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";

const ALLOWED_ACTIONS = new Set(["viewed", "clicked_alternative", "dismissed"]);

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

  await prisma.event.create({
    data: { sessionId, action, productScanned, verdictShown, country },
  });

  return NextResponse.json({ ok: true });
}
