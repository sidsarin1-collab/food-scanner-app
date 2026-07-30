import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { scoreIngredientList } from "@/lib/scoring";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const ingredientList: unknown = body?.ingredientList;

  if (typeof ingredientList !== "string" || !ingredientList.trim()) {
    return NextResponse.json(
      { error: "ingredientList is required" },
      { status: 400 }
    );
  }

  const chemicals = await prisma.chemical.findMany({
    where: { matchable: true },
    select: {
      id: true,
      name: true,
      aliases: true,
      severityTier: true,
      category: true,
      healthEffect: true,
      bannedInCountries: true,
      commonSubstituteNote: true,
    },
  });

  const result = scoreIngredientList(ingredientList, chemicals);

  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : "Untitled product";
  const brand = typeof body?.brand === "string" && body.brand.trim() ? body.brand.trim() : null;
  const country = typeof body?.country === "string" && body.country.trim() ? body.country.trim() : null;

  await prisma.product.create({
    data: {
      name,
      brand,
      country,
      ingredientList,
      score: result.score,
      verdict: result.verdict,
      flaggedChemicalIds: result.flagged.map((f) => f.chemicalId),
    },
  });

  return NextResponse.json(result);
}
