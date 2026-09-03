import { prisma } from "@/lib/db";

export type MostScannedProduct = { name: string; scanCount: number };
export type FlaggedChemicalStat = { name: string; severityTier: number; flagCount: number };
export type VerdictWeek = { week: string; clean: number; caution: number; avoid: number };
export type CountryStat = { country: string; scanCount: number };
export type DailyCountryVisitors = { day: string; country: string; city: string | null; uniqueVisitors: number };

/** Most-scanned products in the last 7 days. Excludes the "Untitled product"
 * placeholder used when no name was given -- it isn't a real product identity. */
export async function getMostScannedThisWeek(): Promise<MostScannedProduct[]> {
  const rows = await prisma.$queryRaw<{ name: string; scan_count: bigint }[]>`
    SELECT name, COUNT(*)::int as scan_count
    FROM products
    WHERE last_checked >= NOW() - INTERVAL '7 days'
      AND name != 'Untitled product'
    GROUP BY name
    ORDER BY scan_count DESC
    LIMIT 10
  `;
  return rows.map((r) => ({ name: r.name, scanCount: Number(r.scan_count) }));
}

/** Top 10 chemicals flagged across all scans, using the `flagged_chemical_ids`
 * array column populated at scan time (see /api/score) via Postgres unnest(). */
export async function getTopFlaggedChemicals(): Promise<FlaggedChemicalStat[]> {
  const rows = await prisma.$queryRaw<{ name: string; severity_tier: number; flag_count: bigint }[]>`
    SELECT c.name, c.severity_tier, COUNT(*)::int as flag_count
    FROM products p, unnest(p.flagged_chemical_ids) as chem_id
    JOIN chemicals c ON c.id = chem_id
    GROUP BY c.name, c.severity_tier
    ORDER BY flag_count DESC
    LIMIT 10
  `;
  return rows.map((r) => ({
    name: r.name,
    severityTier: r.severity_tier,
    flagCount: Number(r.flag_count),
  }));
}

/** Clean/Caution/Avoid mix per week, over the last 12 weeks. */
export async function getVerdictRatioOverTime(): Promise<VerdictWeek[]> {
  const rows = await prisma.$queryRaw<{ week: Date; verdict: string; count: bigint }[]>`
    SELECT DATE_TRUNC('week', last_checked)::date as week, verdict, COUNT(*)::int as count
    FROM products
    WHERE last_checked >= NOW() - INTERVAL '12 weeks'
    GROUP BY week, verdict
    ORDER BY week ASC
  `;

  const byWeek = new Map<string, VerdictWeek>();
  for (const row of rows) {
    const key = row.week.toISOString().slice(0, 10);
    if (!byWeek.has(key)) {
      byWeek.set(key, { week: key, clean: 0, caution: 0, avoid: 0 });
    }
    const entry = byWeek.get(key)!;
    const count = Number(row.count);
    if (row.verdict === "Clean") entry.clean = count;
    else if (row.verdict === "Caution") entry.caution = count;
    else if (row.verdict === "Avoid") entry.avoid = count;
  }
  return Array.from(byWeek.values()).sort((a, b) => a.week.localeCompare(b.week));
}

/** Scan volume by self-selected country (all-time). */
export async function getScansByCountry(): Promise<CountryStat[]> {
  const rows = await prisma.$queryRaw<{ country: string | null; scan_count: bigint }[]>`
    SELECT country, COUNT(*)::int as scan_count
    FROM products
    GROUP BY country
    ORDER BY scan_count DESC
  `;
  return rows.map((r) => ({ country: r.country ?? "Unknown", scanCount: Number(r.scan_count) }));
}

/** Unique visitors (by session_id) per day per IP-derived country/city, last
 * 30 days. Uses `detected_country`/`detected_city` (resolved from the
 * request IP at event time, IP itself never stored) -- not the self-selected
 * `country` search parameter. City is frequently null (weaker coverage in
 * the free geoip dataset -- VPNs, mobile carriers, many residential IPs). */
export async function getDailyUniqueVisitorsByCountry(): Promise<DailyCountryVisitors[]> {
  const rows = await prisma.$queryRaw<
    { day: Date; country: string | null; city: string | null; unique_visitors: bigint }[]
  >`
    SELECT DATE_TRUNC('day', timestamp)::date as day, detected_country as country, detected_city as city,
           COUNT(DISTINCT session_id)::int as unique_visitors
    FROM events
    WHERE timestamp >= NOW() - INTERVAL '30 days'
    GROUP BY day, detected_country, detected_city
    ORDER BY day DESC, unique_visitors DESC
  `;
  return rows.map((r) => ({
    day: r.day.toISOString().slice(0, 10),
    country: r.country ?? "Unknown",
    city: r.city,
    uniqueVisitors: Number(r.unique_visitors),
  }));
}
