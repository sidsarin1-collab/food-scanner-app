export type ChemicalForMatching = {
  id: string;
  name: string;
  aliases: string[];
  severityTier: number;
  category: string | null;
  healthEffect: string | null;
  bannedInCountries: string | null;
  commonSubstituteNote: string | null;
};

export type FlaggedIngredient = {
  ingredientText: string;
  chemicalId: string;
  chemicalName: string;
  matchedTerm: string;
  matchType: "exact" | "fuzzy";
  severityTier: number;
  tierLabel: "Bad" | "Badder" | "Ugly";
  pointsDeducted: number;
  category: string | null;
  healthEffect: string | null;
  bannedInCountries: string | null;
  commonSubstituteNote: string | null;
};

export type ScoreResult = {
  score: number;
  verdict: "Clean" | "Caution" | "Avoid";
  ingredientCount: number;
  flagged: FlaggedIngredient[];
};

const TIER_POINTS: Record<number, number> = { 1: 5, 2: 15, 3: 30 };
const TIER_LABELS: Record<number, "Bad" | "Badder" | "Ugly"> = {
  1: "Bad",
  2: "Badder",
  3: "Ugly",
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Splits a raw ingredient-list string into individual candidate ingredient phrases. */
export function splitIngredients(text: string): string[] {
  // Parenthetical sub-lists (e.g. "Natural Flavor (contains soy)") get flattened so
  // their contents are also checked as standalone candidate ingredients.
  const flattened = text.replace(/[()]/g, ",");
  const parts = flattened
    .split(/[,;\n]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return Array.from(new Set(parts));
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function wordsOf(s: string): string[] {
  return s.split(" ").filter(Boolean);
}

/** Does `needle` appear in `haystack` as a contiguous run of whole words? */
function containsWordPhrase(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

function isExactMatch(token: string, term: string): boolean {
  if (!token || !term) return false;
  if (token === term) return true;
  if (term.length <= 4) {
    // Short acronyms (MSG, SO2, ADA...) require a whole-word match so they don't
    // fire on an unrelated word that merely contains those letters.
    return new RegExp(`\\b${escapeRegex(term)}\\b`).test(token);
  }
  // Only match when the ingredient phrase contains the FULL chemical term as
  // whole words (e.g. "Titanium Dioxide (color)" contains "titanium dioxide").
  // Deliberately one-directional: matching the other way (a short/generic
  // ingredient word like "sugar" or "water" being contained *inside* a longer
  // term like "Refined Sugars" or "High Chlorine in Drinking Water") caused
  // false positives on ordinary ingredients and was removed.
  return containsWordPhrase(wordsOf(token), wordsOf(term));
}

function isFuzzyMatch(token: string, term: string): boolean {
  if (token.length < 4 || term.length < 4) return false;
  // Fuzzy/typo tolerance only makes sense for natural-language words (a
  // missing letter in "Titanium Dioxide" is still clearly that chemical).
  // A numeric regulatory code has no such property: "INS 296" and "INS 250"
  // are two DIFFERENT additives one edit apart, not a typo of each other.
  // Allowing fuzzy matches on digits caused a single "INS 296" mention to
  // cross-match eight unrelated chemicals. Codes must match exactly.
  if (/\d/.test(term) || /\d/.test(token)) return false;
  const distance = levenshtein(token, term);
  const allowed = term.length <= 6 ? 1 : 2;
  return distance <= allowed;
}

type Term = { term: string; chemical: ChemicalForMatching };

export function scoreIngredientList(
  ingredientListText: string,
  chemicals: ChemicalForMatching[]
): ScoreResult {
  const terms: Term[] = [];
  for (const chemical of chemicals) {
    terms.push({ term: normalize(chemical.name), chemical });
    for (const alias of chemical.aliases) {
      const normAlias = normalize(alias);
      if (normAlias) terms.push({ term: normAlias, chemical });
    }
  }

  const tokens = splitIngredients(ingredientListText);
  const matchesByChemical = new Map<
    string,
    { chemical: ChemicalForMatching; matchedTerm: string; matchType: "exact" | "fuzzy"; ingredientText: string }
  >();

  for (const rawToken of tokens) {
    const token = normalize(rawToken);
    if (!token) continue;

    let foundExact = false;
    for (const { term, chemical } of terms) {
      if (!term) continue;
      if (isExactMatch(token, term)) {
        foundExact = true;
        if (!matchesByChemical.has(chemical.id)) {
          matchesByChemical.set(chemical.id, {
            chemical,
            matchedTerm: term,
            matchType: "exact",
            ingredientText: rawToken.trim(),
          });
        }
      }
    }

    if (!foundExact) {
      for (const { term, chemical } of terms) {
        if (!term) continue;
        if (isFuzzyMatch(token, term) && !matchesByChemical.has(chemical.id)) {
          matchesByChemical.set(chemical.id, {
            chemical,
            matchedTerm: term,
            matchType: "fuzzy",
            ingredientText: rawToken.trim(),
          });
        }
      }
    }
  }

  const flagged: FlaggedIngredient[] = [];
  let score = 100;

  for (const match of matchesByChemical.values()) {
    const tier = match.chemical.severityTier;
    const points = TIER_POINTS[tier] ?? 0;
    score -= points;
    flagged.push({
      ingredientText: match.ingredientText,
      chemicalId: match.chemical.id,
      chemicalName: match.chemical.name,
      matchedTerm: match.matchedTerm,
      matchType: match.matchType,
      severityTier: tier,
      tierLabel: TIER_LABELS[tier] ?? "Bad",
      pointsDeducted: points,
      category: match.chemical.category,
      healthEffect: match.chemical.healthEffect,
      bannedInCountries: match.chemical.bannedInCountries,
      commonSubstituteNote: match.chemical.commonSubstituteNote,
    });
  }

  score = Math.max(0, score);
  flagged.sort((a, b) => b.severityTier - a.severityTier);

  const verdict: ScoreResult["verdict"] =
    score >= 70 ? "Clean" : score >= 40 ? "Caution" : "Avoid";

  return { score, verdict, ingredientCount: tokens.length, flagged };
}
