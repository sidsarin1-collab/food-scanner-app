import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isAuthedAdmin } from "@/lib/auth";
import { findAliasConflicts, describeAliasConflicts } from "@/lib/chemicalConflicts";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!isAuthedAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const suggestion = await prisma.suggestedChemical.findUnique({ where: { id: params.id } });
  if (!suggestion) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }

  // A duplicate suggestion for the same chemical (e.g. two near-simultaneous
  // scans hitting the same unmatched ingredient before either's dedup check
  // could see the other) may still be sitting in the queue -- catch it here
  // rather than let it become a second live chemical row.
  const conflicts = await findAliasConflicts(suggestion.name, []);
  if (conflicts.length > 0) {
    return NextResponse.json(
      { error: `${describeAliasConflicts(conflicts)} Reject this suggestion instead, or edit the name first.` },
      { status: 409 }
    );
  }

  try {
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
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: `A chemical named "${suggestion.name}" already exists. Reject this suggestion instead.` },
        { status: 409 }
      );
    }
    throw err;
  }
}
