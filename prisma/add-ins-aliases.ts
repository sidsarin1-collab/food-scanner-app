/**
 * One-off: adds Codex/FSSAI INS-number aliases (e.g. "INS 211") to existing
 * chemical rows, so Indian labels that print INS numbers instead of names
 * (e.g. "INS 627" instead of a chemical name) can still be matched.
 *
 * Every mapping here was verified against a real source (Wikipedia E-number
 * tables, Codex GSFA, or FSSAI-focused search results) before being added --
 * see the PR/commit description for citations. Nothing was added from
 * unverified memory. Only appends an alias to a name that already exists in
 * the database; never creates a new chemical row.
 *
 * Safe to re-run: skips any alias already present.
 */
import { prisma } from "../src/lib/db";

const INS_ALIASES: Record<string, string[]> = {
  "Sodium Benzoate": ["INS 211"],
  "Titanium Dioxide": ["INS 171"],
  "Polysorbate 80": ["INS 433"],
  "Sodium Nitrite": ["INS 250"],
  "Sulfur Dioxide": ["INS 220"],
  "Monosodium Glutamate": ["INS 621"],
  "Carrageenan": ["INS 407"],
  "BHA": ["INS 320"],
  "BHT": ["INS 321"],
  "TBHQ": ["INS 319"],
  "Potassium Bromate": ["INS 924a"],
  "Erythrosine": ["INS 127"],
  "Calcium Propionate": ["INS 282"],
  "Sodium Erythorbate": ["INS 316"],
  "Azodicarbonamide": ["INS 927a"],
  "Brominated Vegetable Oil": ["INS 443"],
  "Sorbates": ["INS 202"],
  "Sodium Aluminum Phosphate": ["INS 541"],
  "Propylene Glycol": ["INS 1520"],
  "Propylene Glycol Esters": ["INS 477"],
  "Potassium Lactate": ["INS 326"],
  "Ethoxyquin": ["INS 324"],
  "Dimethylpolysiloxane": ["INS 900a"],
  "Magnesium Stearate": ["INS 470(iii)"],
  "Ammonium Sulfate": ["INS 517"],
  "Aspartame": ["INS 951"],
  "Cyclamates": ["INS 952"],
  // This row's existing alias ("Class IV / 4-MEI") already identifies it as
  // specifically Caramel Class IV.
  "Caramel Coloring": ["INS 150d"],
  // This row's own name covers both classes III and IV.
  "Caramel Coloring III/IV": ["INS 150c", "INS 150d"],
};

async function main() {
  let updated = 0;
  let skippedNoRow: string[] = [];

  for (const [name, newAliases] of Object.entries(INS_ALIASES)) {
    const chemical = await prisma.chemical.findFirst({ where: { name } });
    if (!chemical) {
      skippedNoRow.push(name);
      continue;
    }
    const merged = Array.from(new Set([...chemical.aliases, ...newAliases]));
    if (merged.length === chemical.aliases.length) continue; // nothing new
    await prisma.chemical.update({ where: { id: chemical.id }, data: { aliases: merged } });
    console.log(`${name}: aliases -> ${JSON.stringify(merged)}`);
    updated++;
  }

  console.log(`\nUpdated ${updated} row(s).`);
  if (skippedNoRow.length) {
    console.log(`No matching row found for: ${skippedNoRow.join(", ")}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
