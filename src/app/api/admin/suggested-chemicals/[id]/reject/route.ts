import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthedAdmin } from "@/lib/auth";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!isAuthedAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await prisma.suggestedChemical.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }
}
