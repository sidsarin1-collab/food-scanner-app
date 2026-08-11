import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isAuthedAdmin } from "@/lib/auth";
import { parseChemicalInput } from "@/lib/chemicalInput";
import { findAliasConflicts, describeAliasConflicts } from "@/lib/chemicalConflicts";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!isAuthedAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = parseChemicalInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const conflicts = await findAliasConflicts(parsed.name, parsed.aliases, params.id);
  if (conflicts.length > 0) {
    return NextResponse.json({ error: describeAliasConflicts(conflicts) }, { status: 409 });
  }

  try {
    const chemical = await prisma.chemical.update({
      where: { id: params.id },
      data: parsed,
    });
    return NextResponse.json(chemical);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: `A chemical named "${parsed.name}" already exists.` }, { status: 409 });
    }
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
