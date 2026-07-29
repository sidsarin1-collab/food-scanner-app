import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthedAdmin } from "@/lib/auth";
import { parseChemicalInput } from "@/lib/chemicalInput";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!isAuthedAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = parseChemicalInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  try {
    const chemical = await prisma.chemical.update({
      where: { id: params.id },
      data: parsed,
    });
    return NextResponse.json(chemical);
  } catch {
    return NextResponse.json({ error: "Chemical not found" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!isAuthedAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await prisma.chemical.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Chemical not found" }, { status: 404 });
  }
}
