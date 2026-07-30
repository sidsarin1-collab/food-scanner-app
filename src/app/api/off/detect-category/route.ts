import { NextResponse } from "next/server";
import { searchProductsByName } from "@/lib/offClient";
import { CATEGORIES } from "@/lib/categories";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name: unknown = body?.name;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ category: null });
  }

  let candidates;
  try {
    candidates = await searchProductsByName(name.trim());
  } catch {
    return NextResponse.json({ category: null });
  }

  for (const product of candidates) {
    const tags = product.categories_tags ?? [];
    const match = CATEGORIES.find((c) => tags.includes(c.offTag));
    if (match) {
      return NextResponse.json({ category: match });
    }
  }

  return NextResponse.json({ category: null });
}
