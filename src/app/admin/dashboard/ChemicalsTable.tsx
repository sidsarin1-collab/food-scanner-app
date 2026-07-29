"use client";

import { Dispatch, Fragment, ReactNode, SetStateAction, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Chemical = {
  id: string;
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
  lastUpdated: string;
};

type FormState = {
  name: string;
  aliases: string;
  severityTier: number;
  category: string;
  healthEffect: string;
  bannedInCountries: string;
  commonSubstituteNote: string;
  sourceNote: string;
  foundIn: string;
  exampleBrands: string;
  timeToManifest: string;
  matchable: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  aliases: "",
  severityTier: 1,
  category: "",
  healthEffect: "",
  bannedInCountries: "",
  commonSubstituteNote: "",
  sourceNote: "",
  foundIn: "",
  exampleBrands: "",
  timeToManifest: "",
  matchable: true,
};

function toForm(c: Chemical): FormState {
  return {
    name: c.name,
    aliases: c.aliases.join(", "),
    severityTier: c.severityTier,
    category: c.category ?? "",
    healthEffect: c.healthEffect ?? "",
    bannedInCountries: c.bannedInCountries ?? "",
    commonSubstituteNote: c.commonSubstituteNote ?? "",
    sourceNote: c.sourceNote ?? "",
    foundIn: c.foundIn ?? "",
    exampleBrands: c.exampleBrands ?? "",
    timeToManifest: c.timeToManifest ?? "",
    matchable: c.matchable,
  };
}

const TIER_LABEL: Record<number, string> = { 1: "Bad", 2: "Badder", 3: "Ugly" };

export default function ChemicalsTable() {
  const router = useRouter();
  const [chemicals, setChemicals] = useState<Chemical[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [filterTier, setFilterTier] = useState<number | "all">("all");
  const [search, setSearch] = useState("");

  async function loadChemicals() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/chemicals");
      if (!res.ok) throw new Error("Failed to load chemicals");
      setChemicals(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chemicals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadChemicals();
  }, []);

  function startEdit(c: Chemical) {
    setEditingId(c.id);
    setForm(toForm(c));
  }

  function startAdd() {
    setEditingId("new");
    setForm(EMPTY_FORM);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin");
    router.refresh();
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name,
      aliases: form.aliases,
      severityTier: form.severityTier,
      category: form.category,
      healthEffect: form.healthEffect,
      bannedInCountries: form.bannedInCountries,
      commonSubstituteNote: form.commonSubstituteNote,
      sourceNote: form.sourceNote,
      foundIn: form.foundIn,
      exampleBrands: form.exampleBrands,
      timeToManifest: form.timeToManifest,
      matchable: form.matchable,
    };
    try {
      const url = editingId === "new" ? "/api/admin/chemicals" : `/api/admin/chemicals/${editingId}`;
      const method = editingId === "new" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Save failed");
      }
      cancelEdit();
      await loadChemicals();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this chemical? This cannot be undone.")) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/chemicals/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setChemicals((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const visible = chemicals.filter((c) => {
    if (filterTier !== "all" && c.severityTier !== filterTier) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Chemicals ({chemicals.length})</h1>
        <div className="flex gap-2">
          <button
            onClick={startAdd}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            + Add chemical
          </button>
          <button onClick={handleLogout} className="text-sm text-neutral-500 underline">
            Log out
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name..."
          className="rounded-lg border border-neutral-300 p-2 text-sm"
        />
        <select
          value={filterTier}
          onChange={(e) => setFilterTier(e.target.value === "all" ? "all" : Number(e.target.value))}
          className="rounded-lg border border-neutral-300 p-2 text-sm"
        >
          <option value="all">All tiers</option>
          <option value={1}>Tier 1 · Bad</option>
          <option value={2}>Tier 2 · Badder</option>
          <option value={3}>Tier 3 · Ugly</option>
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {editingId === "new" && (
        <ChemicalForm form={form} setForm={setForm} onSave={handleSave} onCancel={cancelEdit} saving={saving} isNew />
      )}

      {loading ? (
        <p className="text-sm text-neutral-500">Loading...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-100 text-xs uppercase text-neutral-500">
              <tr>
                <th className="p-2">Name</th>
                <th className="p-2">Tier</th>
                <th className="p-2">Category</th>
                <th className="p-2">Matchable</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <Fragment key={c.id}>
                  <tr className="border-t border-neutral-200">
                    <td className="p-2 font-medium">{c.name}</td>
                    <td className="p-2">
                      Tier {c.severityTier} · {TIER_LABEL[c.severityTier]}
                    </td>
                    <td className="p-2 text-neutral-600">{c.category || "—"}</td>
                    <td className="p-2">{c.matchable ? "Yes" : "No (informational)"}</td>
                    <td className="p-2">
                      <button onClick={() => startEdit(c)} className="mr-3 text-neutral-700 underline">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="text-red-600 underline">
                        Delete
                      </button>
                    </td>
                  </tr>
                  {editingId === c.id && (
                    <tr className="border-t border-neutral-200 bg-neutral-50">
                      <td colSpan={5} className="p-4">
                        <ChemicalForm
                          form={form}
                          setForm={setForm}
                          onSave={handleSave}
                          onCancel={cancelEdit}
                          saving={saving}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ChemicalForm({
  form,
  setForm,
  onSave,
  onCancel,
  saving,
  isNew,
}: {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isNew?: boolean;
}) {
  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="space-y-3 rounded-lg border border-neutral-300 bg-white p-4">
      <h2 className="font-semibold">{isNew ? "New chemical" : "Edit chemical"}</h2>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name">
          <input value={form.name} onChange={(e) => set("name", e.target.value)} className="input" />
        </Field>
        <Field label="Aliases (comma-separated)">
          <input value={form.aliases} onChange={(e) => set("aliases", e.target.value)} className="input" />
        </Field>
        <Field label="Severity tier">
          <select
            value={form.severityTier}
            onChange={(e) => set("severityTier", Number(e.target.value))}
            className="input"
          >
            <option value={1}>Tier 1 · Bad (-5 pts)</option>
            <option value={2}>Tier 2 · Badder (-15 pts)</option>
            <option value={3}>Tier 3 · Ugly (-30 pts)</option>
          </select>
        </Field>
        <Field label="Category">
          <input value={form.category} onChange={(e) => set("category", e.target.value)} className="input" />
        </Field>
        <Field label="Banned/restricted in">
          <input
            value={form.bannedInCountries}
            onChange={(e) => set("bannedInCountries", e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Found in">
          <input value={form.foundIn} onChange={(e) => set("foundIn", e.target.value)} className="input" />
        </Field>
        <Field label="Example brands">
          <input
            value={form.exampleBrands}
            onChange={(e) => set("exampleBrands", e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Time to manifest">
          <input
            value={form.timeToManifest}
            onChange={(e) => set("timeToManifest", e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Source note">
          <input value={form.sourceNote} onChange={(e) => set("sourceNote", e.target.value)} className="input" />
        </Field>
        <Field label="Matchable (used in scoring)">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.matchable}
              onChange={(e) => set("matchable", e.target.checked)}
            />
            Include in automatic ingredient matching
          </label>
        </Field>
      </div>
      <Field label="Health effect">
        <textarea
          value={form.healthEffect}
          onChange={(e) => set("healthEffect", e.target.value)}
          className="input"
          rows={2}
        />
      </Field>
      <Field label="Safer substitute note">
        <textarea
          value={form.commonSubstituteNote}
          onChange={(e) => set("commonSubstituteNote", e.target.value)}
          className="input"
          rows={2}
        />
      </Field>

      <div className="flex gap-2 pt-2">
        <button
          onClick={onSave}
          disabled={saving || !form.name}
          className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button onClick={onCancel} className="rounded-lg border border-neutral-300 px-4 py-1.5 text-sm">
          Cancel
        </button>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border: 1px solid #d4d4d4;
          border-radius: 0.5rem;
          padding: 0.4rem 0.6rem;
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium uppercase text-neutral-500">{label}</span>
      {children}
    </label>
  );
}
