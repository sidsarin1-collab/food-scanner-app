"use client";

import { FormEvent, useState } from "react";

type FlaggedIngredient = {
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

type ScoreResult = {
  score: number;
  verdict: "Clean" | "Caution" | "Avoid";
  ingredientCount: number;
  flagged: FlaggedIngredient[];
};

const VERDICT_STYLES: Record<ScoreResult["verdict"], string> = {
  Clean: "bg-green-100 text-green-800 border-green-300",
  Caution: "bg-amber-100 text-amber-800 border-amber-300",
  Avoid: "bg-red-100 text-red-800 border-red-300",
};

const TIER_STYLES: Record<number, string> = {
  1: "bg-yellow-100 text-yellow-800",
  2: "bg-orange-100 text-orange-800",
  3: "bg-red-100 text-red-800",
};

export default function HomePage() {
  const [ingredientList, setIngredientList] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScoreResult | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ingredientList.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredientList, name, brand }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Something went wrong");
      }
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Check an ingredient list</h1>
        <p className="mt-1 text-neutral-600">
          Paste a product&apos;s ingredient list below to see its safety score.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          value={ingredientList}
          onChange={(e) => setIngredientList(e.target.value)}
          placeholder="e.g. Enriched Flour, Sugar, Titanium Dioxide, Red 40, Sodium Benzoate..."
          rows={6}
          className="w-full rounded-lg border border-neutral-300 p-3 text-sm focus:border-neutral-500 focus:outline-none"
          required
        />

        <button
          type="button"
          onClick={() => setShowDetails((s) => !s)}
          className="text-sm text-neutral-500 underline"
        >
          {showDetails ? "Hide" : "Add"} product name / brand (optional)
        </button>

        {showDetails && (
          <div className="grid grid-cols-2 gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Product name"
              className="rounded-lg border border-neutral-300 p-2 text-sm"
            />
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Brand"
              className="rounded-lg border border-neutral-300 p-2 text-sm"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !ingredientList.trim()}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Checking..." : "Check ingredients"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="space-y-6 border-t border-neutral-200 pt-6">
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold">{result.score}</div>
            <span
              className={`rounded-full border px-3 py-1 text-sm font-semibold ${VERDICT_STYLES[result.verdict]}`}
            >
              {result.verdict}
            </span>
            <span className="text-sm text-neutral-500">
              {result.ingredientCount} ingredient phrase{result.ingredientCount === 1 ? "" : "s"} scanned
            </span>
          </div>

          {result.flagged.length === 0 ? (
            <p className="text-sm text-neutral-600">No flagged ingredients found.</p>
          ) : (
            <div className="space-y-3">
              <h2 className="font-semibold">Flagged ingredients</h2>
              {result.flagged.map((f) => (
                <div key={f.chemicalId} className="rounded-lg border border-neutral-200 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${TIER_STYLES[f.severityTier]}`}>
                      Tier {f.severityTier} · {f.tierLabel}
                    </span>
                    <span className="font-medium">{f.chemicalName}</span>
                    <span className="text-xs text-neutral-500">
                      matched &quot;{f.ingredientText}&quot;
                      {f.matchType === "fuzzy" ? " (fuzzy match)" : ""}
                    </span>
                    <span className="ml-auto text-sm font-semibold text-red-600">
                      -{f.pointsDeducted} pts
                    </span>
                  </div>
                  {f.healthEffect && (
                    <p className="mt-2 text-sm text-neutral-700">{f.healthEffect}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-500">
                    {f.bannedInCountries && <span>Banned/restricted: {f.bannedInCountries}</span>}
                    {f.commonSubstituteNote && <span>Safer alt: {f.commonSubstituteNote}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
