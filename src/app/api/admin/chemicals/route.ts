import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isAuthedAdmin } from "@/lib/auth";
import { parseChemicalInput } from "@/lib/chemicalInput";
import { findAliasConflicts, describeAliasConflicts } from "@/lib/chemicalConflicts";

export async function GET() {
  if (!isAuthedAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const chemicals = await prisma.chemical.findMany({
    orderBy: [{ severityTier: "desc" }, { name: "asc" }],
  });
  return NextResponse.json(chemicals);
}

export async function POST(req: Request) {
  if (!isAuthedAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = parseChemicalInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const conflicts = await findAliasConflicts(parsed.name, parsed.aliases);
  if (conflicts.length > 0) {
    return NextResponse.json({ error: describeAliasConflicts(conflicts) }, { status: 409 });
  }

  try {
    const chemical = await prisma.chemical.create({ data: parsed });
    return NextResponse.json(chemical, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: `A chemical named "${parsed.name}" already exists.` }, { status: 409 });
    }
    throw err;
  }
}
