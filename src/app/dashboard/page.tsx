import { redirect } from "next/navigation";
import Link from "next/link";
import { isAuthedAdmin } from "@/lib/auth";
import {
  getMostScannedThisWeek,
  getTopFlaggedChemicals,
  getVerdictRatioOverTime,
  getScansByCountry,
} from "@/lib/dashboardStats";

const TIER_LABEL: Record<number, string> = { 1: "Bad", 2: "Badder", 3: "Ugly" };
const TIER_STYLES: Record<number, string> = {
  1: "bg-yellow-100 text-yellow-800",
  2: "bg-orange-100 text-orange-800",
  3: "bg-red-100 text-red-800",
};

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max((value / max) * 100, 2) : 0;
  return (
    <div className="h-2 w-full rounded bg-neutral-100">
      <div className="h-2 rounded bg-neutral-700" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default async function DashboardPage() {
  if (!isAuthedAdmin()) {
    redirect("/admin");
  }

  const [mostScanned, topFlagged, verdictWeeks, byCountry] = await Promise.all([
    getMostScannedThisWeek(),
    getTopFlaggedChemicals(),
    getVerdictRatioOverTime(),
    getScansByCountry(),
  ]);

  const maxScanned = Math.max(1, ...mostScanned.map((p) => p.scanCount));
  const maxFlagged = Math.max(1, ...topFlagged.map((c) => c.flagCount));
  const maxCountry = Math.max(1, ...byCountry.map((c) => c.scanCount));

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <Link href="/admin/dashboard" className="text-sm text-neutral-500 underline">
          Manage chemicals
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">Most-scanned products this week</h2>
        {mostScanned.length === 0 ? (
          <p className="text-sm text-neutral-500">No named scans in the last 7 days.</p>
        ) : (
          <div className="space-y-2">
            {mostScanned.map((p) => (
              <div key={p.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-neutral-500">{p.scanCount}</span>
                </div>
                <Bar value={p.scanCount} max={maxScanned} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Top 10 most-frequently-flagged chemicals</h2>
        {topFlagged.length === 0 ? (
          <p className="text-sm text-neutral-500">No flagged chemicals recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {topFlagged.map((c) => (
              <div key={c.name} className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${TIER_STYLES[c.severityTier]}`}>
                    Tier {c.severityTier} · {TIER_LABEL[c.severityTier]}
                  </span>
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-auto text-neutral-500">{c.flagCount}</span>
                </div>
                <Bar value={c.flagCount} max={maxFlagged} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Clean / Caution / Avoid ratio, last 12 weeks</h2>
        {verdictWeeks.length === 0 ? (
          <p className="text-sm text-neutral-500">No scans recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {verdictWeeks.map((w) => {
              const total = w.clean + w.caution + w.avoid;
              return (
                <div key={w.week} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span>{w.week}</span>
                    <span>{total} scans</span>
                  </div>
                  <div className="flex h-3 w-full overflow-hidden rounded bg-neutral-100">
                    {total > 0 && (
                      <>
                        <div className="h-3 bg-green-400" style={{ width: `${(w.clean / total) * 100}%` }} />
                        <div className="h-3 bg-amber-400" style={{ width: `${(w.caution / total) * 100}%` }} />
                        <div className="h-3 bg-red-400" style={{ width: `${(w.avoid / total) * 100}%` }} />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="flex gap-4 pt-1 text-xs text-neutral-500">
              <span><span className="inline-block h-2 w-2 rounded-full bg-green-400" /> Clean</span>
              <span><span className="inline-block h-2 w-2 rounded-full bg-amber-400" /> Caution</span>
              <span><span className="inline-block h-2 w-2 rounded-full bg-red-400" /> Avoid</span>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Scans by country</h2>
        {byCountry.length === 0 ? (
          <p className="text-sm text-neutral-500">No scans recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {byCountry.map((c) => (
              <div key={c.country} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{c.country}</span>
                  <span className="text-neutral-500">{c.scanCount}</span>
                </div>
                <Bar value={c.scanCount} max={maxCountry} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
