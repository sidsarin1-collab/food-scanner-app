import { PrismaClient } from "@prisma/client";
import seedData from "./seed-data.json";

const prisma = new PrismaClient();

type SeedRow = {
  name: string;
  aliases: string[];
  severity_tier: number;
  category: string;
  health_effect: string | null;
  banned_in_countries: string | null;
  common_substitute_note: string | null;
  source_note: string | null;
  found_in: string | null;
  example_brands: string | null;
  time_to_manifest: string | null;
  matchable: boolean;
};

async function main() {
  const rows = seedData as SeedRow[];
  console.log(`Seeding ${rows.length} chemicals...`);

  for (const row of rows) {
    const existing = await prisma.chemical.findFirst({
      where: { name: row.name },
    });

    const data = {
      name: row.name,
      aliases: row.aliases,
      severityTier: row.severity_tier,
      category: row.category,
      healthEffect: row.health_effect,
      bannedInCountries: row.banned_in_countries,
      commonSubstituteNote: row.common_substitute_note,
      sourceNote: row.source_note,
      foundIn: row.found_in,
      exampleBrands: row.example_brands,
      timeToManifest: row.time_to_manifest,
      matchable: row.matchable,
    };

    if (existing) {
      await prisma.chemical.update({ where: { id: existing.id }, data });
    } else {
      await prisma.chemical.create({ data });
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
