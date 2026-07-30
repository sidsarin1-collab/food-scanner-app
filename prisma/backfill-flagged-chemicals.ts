/**
 * One-off backfill for the Phase 5 dashboard: populates `flaggedChemicalIds`
 * on existing product rows (recorded before that column existed) by
 * re-running the current scoring engine against each row's stored
 * `ingredientList`. This uses TODAY's chemical rules, not whatever the
 * database looked like at the time of that historical scan -- an accepted
 * approximation, not an exact replay of history.
 *
 * Safe to re-run: it recomputes every row unconditionally.
 */
import { prisma } from "../src/lib/db";
import { scoreIngredientList } from "../src/lib/scoring";

async function main() {
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

  const products = await prisma.product.findMany({
    select: { id: true, ingredientList: true },
  });

  console.log(`Backfilling flagged chemicals for ${products.length} product(s)...`);

  let updated = 0;
  for (const product of products) {
    const result = scoreIngredientList(product.ingredientList, chemicals);
    await prisma.product.update({
      where: { id: product.id },
      data: { flaggedChemicalIds: result.flagged.map((f) => f.chemicalId) },
    });
    updated++;
  }

  console.log(`Backfill complete: updated ${updated} product(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
