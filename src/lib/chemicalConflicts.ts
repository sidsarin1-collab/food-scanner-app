import { prisma } from "./db";

export type AliasConflict = {
  term: string;
  conflictingChemicalId: string;
  conflictingChemicalName: string;
};

/**
 * Checks whether `name` or any of `aliases` collides (case-insensitively) with
 * the name or an alias of any OTHER chemical already in the table -- the
 * scenario that let "Caramel Coloring" and "Caramel Coloring III/IV" both
 * claim "E150d", causing a single ingredient to double-match and double-deduct.
 */
export async function findAliasConflicts(
  name: string,
  aliases: string[],
  excludeId?: string
): Promise<AliasConflict[]> {
  const others = await prisma.chemical.findMany({
    where: excludeId ? { id: { not: excludeId } } : undefined,
    select: { id: true, name: true, aliases: true },
  });

  const proposedTerms = [name, ...aliases].map((t) => t.trim().toLowerCase()).filter(Boolean);
  const conflicts: AliasConflict[] = [];

  for (const other of others) {
    const otherTerms = new Set([other.name, ...other.aliases].map((t) => t.trim().toLowerCase()));
    for (const term of proposedTerms) {
      if (otherTerms.has(term)) {
        conflicts.push({ term, conflictingChemicalId: other.id, conflictingChemicalName: other.name });
      }
    }
  }

  return conflicts;
}

export function describeAliasConflicts(conflicts: AliasConflict[]): string {
  const parts = conflicts.map((c) => `"${c.term}" is already used by "${c.conflictingChemicalName}"`);
  return `Alias conflict: ${parts.join("; ")}.`;
}
