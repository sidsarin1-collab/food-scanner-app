/**
 * One-off: adds EU E-number aliases (e.g. "E211") alongside the Codex/FSSAI
 * INS-number aliases added in prisma/add-ins-aliases.ts, for the same
 * substances. E-numbers and INS numbers share the same base numbering for
 * almost all of these -- just a different prefix -- but NOT always: verified
 * each one individually rather than assuming. Magnesium Stearate is the one
 * confirmed exception found here: its Codex number is INS 470(iii), but its
 * EU number is the distinct E572, not "E470(iii)".
 *
 * Three rows (Sodium Benzoate, Titanium Dioxide, Polysorbate 80) already had
 * their E-number alias from the original spreadsheet seed and are skipped.
 *
 * Safe to re-run: skips any alias already present.
 */
import { prisma } from "../src/lib/db";

const E_NUMBER_ALIASES: Record<string, string[]> = {
  "Sodium Nitrite": ["E250"],
  "Sulfur Dioxide": ["E220"],
  "Monosodium Glutamate": ["E621"],
  "Carrageenan": ["E407"],
  "BHA": ["E320"],
  "BHT": ["E321"],
  "TBHQ": ["E319"],
  "Potassium Bromate": ["E924a"],
  "Erythrosine": ["E127"],
  "Calcium Propionate": ["E282"],
  "Sodium Erythorbate": ["E316"],
  "Azodicarbonamide": ["E927a"],
  "Brominated Vegetable Oil": ["E443"],
  "Sorbates": ["E202"],
  "Sodium Aluminum Phosphate": ["E541"],
  "Propylene Glycol": ["E1520"],
  "Propylene Glycol Esters": ["E477"],
  "Potassium Lactate": ["E326"],
  "Ethoxyquin": ["E324"],
  "Dimethylpolysiloxane": ["E900a"],
  // Exception: EU number does NOT match the Codex/INS number here.
  "Magnesium Stearate": ["E572"],
  "Ammonium Sulfate": ["E517"],
  "Aspartame": ["E951"],
  "Cyclamates": ["E952"],
  "Caramel Coloring": ["E150d"],
  "Caramel Coloring III/IV": ["E150c", "E150d"],
  "Disodium Guanylate": ["E627"],
  "Disodium Inosinate": ["E631"],
};

async function main() {
  let updated = 0;
  const skippedNoRow: string[] = [];

  for (const [name, newAliases] of Object.entries(E_NUMBER_ALIASES)) {
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
