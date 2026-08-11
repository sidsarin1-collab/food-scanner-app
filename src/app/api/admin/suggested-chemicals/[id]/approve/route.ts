import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthedAdmin } from "@/lib/auth";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!isAuthedAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const suggestion = await prisma.suggestedChemical.findUnique({ where: { id: params.id } });
  if (!suggestion) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }

  const [chemical] = await prisma.$transaction([
    prisma.chemical.create({
      data: {
        name: suggestion.name,
        severityTier: suggestion.proposedTier,
        category: suggestion.proposedCategory,
        healthEffect: suggestion.proposedHealthEffect,
        sourceNote: suggestion.reasoning,
      },
    }),
    prisma.suggestedChemical.delete({ where: { id: suggestion.id } }),
  ]);

  return NextResponse.json(chemical, { status: 201 });
}
