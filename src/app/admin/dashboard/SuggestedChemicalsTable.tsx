"use client";

import { useEffect, useState } from "react";

type Suggestion = {
  id: string;
  name: string;
  proposedTier: number;
  proposedCategory: string | null;
  proposedHealthEffect: string | null;
  sourceIngredientText: string;
  reasoning: string | null;
  createdAt: string;
  possibleDuplicateOfName: string | null;
  possibleDuplicateNote: string | null;
};

const TIER_LABEL: Record<number, string> = { 1: "Bad", 2: "Badder", 3: "Ugly" };

export default function SuggestedChemicalsTable() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/suggested-chemicals");
      if (!res.ok) throw new Error("Failed to load suggestions");
      setSuggestions(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load suggestions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleApprove(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/suggested-chemicals/${id}/approve`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Approve failed");
      }
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/suggested-chemicals/${id}/reject`, { method: "POST" });
      if (!res.ok) throw new Error("Reject failed");
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Suggested Additions ({suggestions.length})</h1>
      <p className="text-sm text-neutral-500">
        Ingredients the gap-finder agent flagged as likely chemical additives not yet in the database. Review and
        approve to add them, or reject to discard.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-neutral-500">Loading...</p>
      ) : suggestions.length === 0 ? (
        <p className="text-sm text-neutral-500">No pending suggestions.</p>
      ) : (
        <div className="space-y-3">
          {suggestions.map((s) => (
            <div
              key={s.id}
              className={`rounded-lg border bg-white p-4 ${
                s.possibleDuplicateOfName ? "border-amber-300" : "border-neutral-200"
              }`}
            >
              {s.possibleDuplicateOfName && (
                <div className="mb-2 rounded-md bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
                  ⚠ Possible duplicate of &ldquo;{s.possibleDuplicateOfName}&rdquo; — {s.possibleDuplicateNote}
                </div>
              )}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-xs text-neutral-500">
                    Tier {s.proposedTier} · {TIER_LABEL[s.proposedTier] ?? "?"}
                    {s.proposedCategory ? ` · ${s.proposedCategory}` : ""}
                  </div>
                  <div className="text-xs text-neutral-500">
                    Seen in ingredient list as: <span className="italic">&ldquo;{s.sourceIngredientText}&rdquo;</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => handleApprove(s.id)}
                    disabled={busyId === s.id}
                    className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(s.id)}
                    disabled={busyId === s.id}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
              {s.proposedHealthEffect && <p className="mt-2 text-sm text-neutral-700">{s.proposedHealthEffect}</p>}
              {s.reasoning && <p className="mt-1 text-xs text-neutral-400">{s.reasoning}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
