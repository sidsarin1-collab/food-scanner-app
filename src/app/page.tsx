"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { CATEGORIES, type Category } from "@/lib/categories";
import { COUNTRIES, DEFAULT_COUNTRY } from "@/lib/countries";
import { trackEvent } from "@/lib/analytics";

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

type Alternative = {
  name: string;
  brand: string | null;
  score: number;
  code: string | null;
};

type AltState = "idle" | "detecting" | "need-category" | "loading" | "ok" | "limited" | "error";

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
  const [country, setCountry] = useState(DEFAULT_COUNTRY.offTag);
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScoreResult | null>(null);

  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [showPhotoNotice, setShowPhotoNotice] = useState(false);

  const [altState, setAltState] = useState<AltState>("idle");
  const [detectedCategory, setDetectedCategory] = useState<Category | null>(null);
  const [manualCategoryTag, setManualCategoryTag] = useState(CATEGORIES[0].offTag);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);

  async function fetchAlternatives(category: Category) {
    setAltState("loading");
    try {
      const res = await fetch("/api/off/alternatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryTag: category.offTag, countryTag: country, excludeName: name }),
      });
      if (!res.ok) throw new Error("lookup failed");
      const data: { status: "ok" | "limited"; results: Alternative[] } = await res.json();
      if (data.status === "ok") {
        setAlternatives(data.results);
        setAltState("ok");
      } else {
        setAlternatives([]);
        setAltState("limited");
      }
    } catch {
      setAltState("error");
    }
  }

  async function runDetection() {
    setAltState("detecting");
    setDetectedCategory(null);
    if (name.trim()) {
      try {
        const res = await fetch("/api/off/detect-category", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const data: { category: Category | null } = await res.json();
        if (data.category) {
          setDetectedCategory(data.category);
          await fetchAlternatives(data.category);
          return;
        }
      } catch {
        // fall through to manual category selection
      }
    }
    setAltState("need-category");
  }

  useEffect(() => {
    if (!result) return;
    if (result.verdict === "Clean") {
      setAltState("idle");
      return;
    }
    runDetection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  async function handlePhotoSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setPhotoLoading(true);
    setPhotoError(null);
    setShowPhotoNotice(false);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/scan-photo", { method: "POST", body: formData });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Couldn't read that photo");
      }
      setIngredientList(body.ingredientText);
      setShowPhotoNotice(true);
      setResult(null);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Couldn't read that photo");
    } finally {
      setPhotoLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ingredientList.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setAltState("idle");
    setAlternatives([]);
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredientList,
          name,
          brand,
          country: COUNTRIES.find((c) => c.offTag === country)?.label,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Something went wrong");
      }
      const data: ScoreResult = await res.json();
      setResult(data);
      const countryLabel = COUNTRIES.find((c) => c.offTag === country)?.label;
      trackEvent({ action: "viewed", name, ingredientList, verdictShown: data.verdict, country: countryLabel });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleClearResults() {
    if (result) {
      const countryLabel = COUNTRIES.find((c) => c.offTag === country)?.label;
      trackEvent({ action: "dismissed", name, ingredientList, verdictShown: result.verdict, country: countryLabel });
    }
    setResult(null);
    setIngredientList("");
    setName("");
    setBrand("");
    setShowPhotoNotice(false);
    setAltState("idle");
    setAlternatives([]);
  }

  function handleAlternativeClick(alt: Alternative) {
    const countryLabel = COUNTRIES.find((c) => c.offTag === country)?.label;
    trackEvent({
      action: "clicked_alternative",
      name: alt.name,
      verdictShown: result?.verdict,
      country: countryLabel,
    });
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
          onChange={(e) => {
            setIngredientList(e.target.value);
            setShowPhotoNotice(false);
          }}
          placeholder="e.g. Enriched Flour, Sugar, Titanium Dioxide, Red 40, Sodium Benzoate..."
          rows={6}
          className="w-full rounded-lg border border-neutral-300 p-3 text-sm focus:border-neutral-500 focus:outline-none"
          required
        />

        <div className="flex items-center gap-3">
          <label className="cursor-pointer rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100">
            {photoLoading ? "Reading photo..." : "📷 Scan a photo instead"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handlePhotoSelected}
              disabled={photoLoading}
              className="hidden"
            />
          </label>
          {showPhotoNotice && (
            <span className="text-xs text-neutral-500">
              Extracted from your photo — check it&apos;s accurate before continuing.
            </span>
          )}
        </div>

        {photoError && <p className="text-sm text-red-600">{photoError}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            Country
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="rounded-lg border border-neutral-300 p-1.5 text-sm"
            >
              {COUNTRIES.map((c) => (
                <option key={c.offTag} value={c.offTag}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => setShowDetails((s) => !s)}
            className="text-sm text-neutral-500 underline"
          >
            {showDetails ? "Hide" : "Add"} product name / brand (optional)
          </button>
        </div>

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
            <button onClick={handleClearResults} className="ml-auto text-sm text-neutral-500 underline">
              Clear results
            </button>
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

          {result.verdict !== "Clean" && (
            <div className="space-y-3 border-t border-neutral-200 pt-6">
              <h2 className="font-semibold">Cleaner alternatives</h2>

              {altState === "detecting" && (
                <p className="text-sm text-neutral-500">Looking up this product&apos;s category...</p>
              )}

              {altState === "loading" && (
                <p className="text-sm text-neutral-500">Searching Open Food Facts for alternatives...</p>
              )}

              {altState === "need-category" && (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-neutral-600">
                    Couldn&apos;t auto-detect the category{name.trim() ? "" : " (no product name given)"} — pick one:
                  </p>
                  <select
                    value={manualCategoryTag}
                    onChange={(e) => setManualCategoryTag(e.target.value)}
                    className="rounded-lg border border-neutral-300 p-1.5 text-sm"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.offTag} value={c.offTag}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const cat = CATEGORIES.find((c) => c.offTag === manualCategoryTag);
                      if (cat) fetchAlternatives(cat);
                    }}
                    className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
                  >
                    Find alternatives
                  </button>
                </div>
              )}

              {altState === "error" && (
                <p className="text-sm text-red-600">Couldn&apos;t reach Open Food Facts right now.</p>
              )}

              {altState === "limited" && (
                <p className="text-sm text-neutral-600">
                  Limited local data — not enough verified Clean-scoring alternatives found for{" "}
                  {COUNTRIES.find((c) => c.offTag === country)?.label} in this category yet.
                </p>
              )}

              {altState === "ok" && (
                <div className="space-y-2">
                  {detectedCategory && (
                    <p className="text-xs text-neutral-500">
                      Category: {detectedCategory.label} (auto-detected)
                    </p>
                  )}
                  {alternatives.map((alt, i) => {
                    const card = (
                      <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 hover:bg-neutral-50">
                        <div>
                          <div className="font-medium">{alt.name}</div>
                          {alt.brand && <div className="text-xs text-neutral-500">{alt.brand}</div>}
                        </div>
                        <span className="rounded-full border border-green-300 bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                          {alt.score} · Clean
                        </span>
                      </div>
                    );
                    return alt.code ? (
                      <a
                        key={`${alt.name}-${i}`}
                        href={`https://world.openfoodfacts.org/product/${alt.code}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleAlternativeClick(alt)}
                        className="block"
                      >
                        {card}
                      </a>
                    ) : (
                      <div key={`${alt.name}-${i}`}>{card}</div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
