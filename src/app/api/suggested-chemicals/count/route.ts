import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Public and unauthenticated on purpose -- the header badge is visible to
// everyone, it just never reveals any suggestion detail before login.
export async function GET() {
  const count = await prisma.suggestedChemical.count();
  return NextResponse.json({ count });
}
