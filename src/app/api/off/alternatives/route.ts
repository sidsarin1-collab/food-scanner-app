import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { scoreIngredientList } from "@/lib/scoring";
import { searchProductsByCategoryAndCountry } from "@/lib/offClient";
import { findCategoryByOffTag } from "@/lib/categories";
import { findCountryByOffTag } from "@/lib/countries";

const MIN_RESULTS = 3;
const MAX_RESULTS = 5;
const CLEAN_THRESHOLD = 70;
const EXCLUDED_NUTRITION_GRADES = new Set(["d", "e"]);
const EXCLUDED_NOVA_GROUPS = new Set([4]);

/** OFF sometimes has product_name set to a raw barcode (contributor data-entry
 * gap) rather than left empty -- a plain numeric string isn't a real name. */
function looksLikeBarcode(name: string): boolean {
  return /^\d{6,14}$/.test(name);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const categoryTag: unknown = body?.categoryTag;
  const countryTag: unknown = body?.countryTag;
  const excludeName: unknown = body?.excludeName;

  if (typeof categoryTag !== "string" || !findCategoryByOffTag(categoryTag)) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }
  if (typeof countryTag !== "string" || !findCountryByOffTag(countryTag)) {
    return NextResponse.json({ error: "Unknown country" }, { status: 400 });
  }

  let candidates;
  try {
    candidates = await searchProductsByCategoryAndCountry(categoryTag, countryTag);
  } catch (err) {
    console.error("Open Food Facts alternatives lookup failed:", err);
    return NextResponse.json({ error: "Open Food Facts lookup failed" }, { status: 502 });
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

  const excludeNormalized =
    typeof excludeName === "string" && excludeName.trim() ? excludeName.trim().toLowerCase() : null;

  const seen = new Set<string>();
  const cleanMatches: {
    name: string;
    brand: string | null;
    score: number;
    code: string | null;
    nutritionGrade: string | null;
    novaGroup: number | null;
  }[] = [];

  for (const product of candidates) {
    const ingredientsText = product.ingredients_text?.trim();
    const name = product.product_name?.trim();
    if (!ingredientsText || !name || looksLikeBarcode(name)) continue;

    const dedupeKey = `${name.toLowerCase()}|${(product.brands ?? "").toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    if (excludeNormalized && name.toLowerCase() === excludeNormalized) continue;

    // Require a Nutri-Score of A/B/C when one is present; a good additive score
    // alone shouldn't surface a nutritionally poor (D/E) product as "cleaner."
    // Missing data isn't treated as a fail -- there's nothing to exclude on.
    const rawGrade = product.nutrition_grades?.trim().toLowerCase();
    if (rawGrade && EXCLUDED_NUTRITION_GRADES.has(rawGrade)) continue;

    // Same rule for NOVA processing group: exclude ultra-processed (4) even
    // with a perfect additive score and a good Nutri-Score, but don't
    // hard-exclude when OFF has no NOVA classification for this product.
    const novaGroup = typeof product.nova_group === "number" ? product.nova_group : null;
    if (novaGroup !== null && EXCLUDED_NOVA_GROUPS.has(novaGroup)) continue;

    const result = scoreIngredientList(ingredientsText, chemicals);
    if (result.verdict !== "Clean") continue;

    seen.add(dedupeKey);
    cleanMatches.push({
      name,
      brand: product.brands?.split(",")[0]?.trim() || null,
      score: result.score,
      code: product.code ?? null,
      nutritionGrade: rawGrade ? rawGrade.toUpperCase() : null,
      novaGroup,
    });
  }

  cleanMatches.sort((a, b) => b.score - a.score);
  const top = cleanMatches.slice(0, MAX_RESULTS);

  if (top.length < MIN_RESULTS) {
    return NextResponse.json({ status: "limited" as const, results: [] });
  }

  return NextResponse.json({ status: "ok" as const, results: top });
}
