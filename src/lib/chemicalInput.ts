export type ChemicalInput = {
  name: string;
  aliases: string[];
  severityTier: number;
  category: string | null;
  healthEffect: string | null;
  bannedInCountries: string | null;
  commonSubstituteNote: string | null;
  sourceNote: string | null;
  foundIn: string | null;
  exampleBrands: string | null;
  timeToManifest: string | null;
  matchable: boolean;
};

function toNullableString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed ? trimmed : null;
}

export function parseChemicalInput(body: unknown): ChemicalInput | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Invalid request body" };
  }
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { error: "name is required" };

  const severityTier = Number(b.severityTier);
  if (![1, 2, 3].includes(severityTier)) {
    return { error: "severityTier must be 1, 2, or 3" };
  }

  let aliases: string[] = [];
  if (Array.isArray(b.aliases)) {
    aliases = b.aliases
      .filter((a): a is string => typeof a === "string")
      .map((a) => a.trim())
      .filter(Boolean);
  } else if (typeof b.aliases === "string") {
    aliases = b.aliases
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
  }

  return {
    name,
    aliases,
    severityTier,
    category: toNullableString(b.category),
    healthEffect: toNullableString(b.healthEffect),
    bannedInCountries: toNullableString(b.bannedInCountries),
    commonSubstituteNote: toNullableString(b.commonSubstituteNote),
    sourceNote: toNullableString(b.sourceNote),
    foundIn: toNullableString(b.foundIn),
    exampleBrands: toNullableString(b.exampleBrands),
    timeToManifest: toNullableString(b.timeToManifest),
    matchable: b.matchable !== false,
  };
}
