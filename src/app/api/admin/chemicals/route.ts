import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthedAdmin } from "@/lib/auth";
import { parseChemicalInput } from "@/lib/chemicalInput";

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
  const chemical = await prisma.chemical.create({ data: parsed });
  return NextResponse.json(chemical, { status: 201 });
}
