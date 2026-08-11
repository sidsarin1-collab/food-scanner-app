import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { scoreIngredientList } from "@/lib/scoring";
import { suggestChemicalForIngredient } from "@/lib/gapFinder";

// Cap per scan so one long ingredient panel can't fan out into a burst of
// Claude calls -- a handful of unmatched ingredients per scan is plenty to
// surface real gaps without runaway API usage.
const MAX_GAP_FINDER_CALLS_PER_SCAN = 5;

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

  // Runs after the response is queued below -- doesn't block the score result.
  // Relies on this being a long-running Node process (Railway), not a
  // serverless function that would be frozen once the response is sent.
  for (const ingredient of result.unmatchedIngredients.slice(0, MAX_GAP_FINDER_CALLS_PER_SCAN)) {
    if (ingredient.length < 3) continue;
    void suggestChemicalForIngredient(ingredient);
  }

  return NextResponse.json(result);
}
