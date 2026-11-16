import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { scoreIngredientList } from "@/lib/scoring";
import { suggestChemicalForIngredient, rankIngredientsForResearch, isObviousNonAdditive } from "@/lib/gapFinder";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rateLimit";
import { readJsonWithLimit, tooLong, TEXT_LIMITS } from "@/lib/requestLimits";

// Cap per scan so one long ingredient panel can't fan out into a burst of
// Claude calls -- ranked by rankIngredientsForResearch first, so this budget
// goes to the most additive-looking candidates rather than just the first N
// in label order (a long list of whole-food ingredients before the real
// additive was exhausting the old cap of 5 before ever reaching it).
const MAX_GAP_FINDER_CALLS_PER_SCAN = 10;

export async function POST(req: Request) {
  const limit = checkRateLimit("score", req);
  if (!limit.ok) return rateLimitedResponse("score", limit);

  const parsed = await readJsonWithLimit(req);
  if (parsed.tooLarge) {
    return NextResponse.json(
      { error: "That request is too large." },
      { status: 413, headers: parsed.fullyRead ? undefined : { Connection: "close" } }
    );
  }
  const body = parsed.body;
  const ingredientList: unknown = body?.ingredientList;

  if (typeof ingredientList !== "string" || !ingredientList.trim()) {
    return NextResponse.json(
      { error: "ingredientList is required" },
      { status: 400 }
    );
  }
  if (tooLong(ingredientList, TEXT_LIMITS.ingredientList)) {
    return NextResponse.json(
      { error: `That ingredient list is too long (max ${TEXT_LIMITS.ingredientList.toLocaleString("en-US")} characters).` },
      { status: 400 }
    );
  }
  if (tooLong(body?.name, TEXT_LIMITS.name)) {
    return NextResponse.json({ error: `Product name is too long (max ${TEXT_LIMITS.name} characters).` }, { status: 400 });
  }
  if (tooLong(body?.brand, TEXT_LIMITS.brand)) {
    return NextResponse.json({ error: `Brand is too long (max ${TEXT_LIMITS.brand} characters).` }, { status: 400 });
  }
  if (tooLong(body?.country, TEXT_LIMITS.country)) {
    return NextResponse.json({ error: `Country is too long (max ${TEXT_LIMITS.country} characters).` }, { status: 400 });
  }

  const chemicals = await prisma.chemical.findMany({
    select: {
      id: true,
      name: true,
      aliases: true,
      severityTier: true,
      category: true,
      healthEffect: true,
      bannedInCountries: true,
      commonSubstituteNote: true,
      matchable: true,
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
  const rankedUnmatched = rankIngredientsForResearch(result.unmatchedIngredients).filter(
    (ingredient) => !isObviousNonAdditive(ingredient)
  );
  for (const ingredient of rankedUnmatched.slice(0, MAX_GAP_FINDER_CALLS_PER_SCAN)) {
    if (ingredient.length < 3) continue;
    void suggestChemicalForIngredient(ingredient);
  }

  return NextResponse.json(result);
}
