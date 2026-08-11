import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthedAdmin } from "@/lib/auth";

export async function GET() {
  if (!isAuthedAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const suggestions = await prisma.suggestedChemical.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(suggestions);
}
