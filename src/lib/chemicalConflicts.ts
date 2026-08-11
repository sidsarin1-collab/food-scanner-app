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

function normalizeWords(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** Same word, or one is a prefix of the other (>=4 chars) -- catches "color"/"coloring". */
function wordsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return true;
  return false;
}

/**
 * Fraction of the shorter name's words that have a match in the longer name's
 * words. Requires at least 2 words on the shorter side -- a single short word
 * (e.g. "Sulfites") would otherwise hit 100% overlap against almost any longer
 * name that happens to contain a similar-sounding word, with no real signal
 * that they're the same substance. Exact single-word duplicates are already
 * caught by findAliasConflicts and the DB unique constraint; this fuzzy check
 * is specifically for reworded/expanded phrasings of multi-word names.
 */
function wordOverlapRatio(a: string[], b: string[]): number {
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.length < 2) return 0;
  const matched = shorter.filter((w) => longer.some((lw) => wordsMatch(w, lw))).length;
  return matched / shorter.length;
}

export type SimilarMatch = { id: string; name: string; overlapRatio: number };

const SIMILARITY_THRESHOLD = 0.6;

/**
 * Looser than findAliasConflicts -- catches near-duplicates with reworded or
 * appended text (e.g. "Caramel Color" vs. an existing "Caramel Coloring III/IV",
 * or "Hydrogenated Palm Kernel Oil" vs. "...(Partially Hydrogenated Oil / Trans
 * Fat Source)"), not just exact string matches. Checks both live chemicals and
 * other pending suggestions, since the gap-finder's own repeated runs on the
 * same substance are exactly what produced those near-duplicates.
 */
export async function findSimilarExisting(
  name: string,
  excludeSuggestionId?: string
): Promise<SimilarMatch[]> {
  const targetWords = normalizeWords(name);
  if (targetWords.length === 0) return [];

  const [chemicals, suggestions] = await Promise.all([
    prisma.chemical.findMany({ select: { id: true, name: true } }),
    prisma.suggestedChemical.findMany({
      where: excludeSuggestionId ? { id: { not: excludeSuggestionId } } : undefined,
      select: { id: true, name: true },
    }),
  ]);

  const candidates = [...chemicals, ...suggestions];
  const matches: SimilarMatch[] = [];

  for (const c of candidates) {
    if (c.name.trim().toLowerCase() === name.trim().toLowerCase()) continue; // exact match handled elsewhere
    const ratio = wordOverlapRatio(targetWords, normalizeWords(c.name));
    if (ratio >= SIMILARITY_THRESHOLD) {
      matches.push({ id: c.id, name: c.name, overlapRatio: ratio });
    }
  }

  return matches.sort((a, b) => b.overlapRatio - a.overlapRatio);
}
