# Ingredient Safety Scanner

Next.js (App Router) + PostgreSQL. Paste an ingredient list, get a 0-100 safety
score, a Clean/Caution/Avoid verdict, and which ingredients were flagged and why.
Chemicals are managed from a password-protected `/admin` page — no code changes
needed to update the list.

## Setup

Requires Node 18+.

```bash
npm install
```

Create `.env` (copy `.env.example`) and fill in:

- `DATABASE_URL` — your Postgres connection string
- `ADMIN_PASSWORD` — the shared password for `/admin`
- `ANTHROPIC_API_KEY` — used server-side only, for photo-based ingredient scanning

Push the schema and seed the chemicals table from the spreadsheet-derived data:

```bash
npx prisma db push
npm run db:seed
```

Run the dev server:

```bash
npm run dev
```

- Public checker: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`

## How the seed data was built

`prisma/seed-data.json` was generated from
`FOOD SCANNER APP ADDITIVES LIST_July 28_2026.xlsx` (93 of the 94 rows — one
was a pure duplicate merged in as an alias). Since your spreadsheet didn't have
columns for every field in the schema, these mappings were applied:

- **category** — auto-classified per row from keyword rules on the name/context
  (Preservative, Artificial Color/Dye, Sweetener, etc.), falling back to "Other
  Additive". Not authoritative — review and correct in `/admin` as needed.
- **aliases** — auto-extracted from parenthetical and slash-separated alt-names
  already in the source name column (e.g. "BHA (Butylated Hydroxyanisole)" →
  alias "Butylated Hydroxyanisole"). A handful of rows where the parenthetical
  was descriptive context rather than a real alt-name (e.g. "Chlorine Washes
  (poultry)") were manually overridden to avoid bogus aliases.
- **matchable** (new field, not in your original schema) — `false` for 17 Tier 3
  rows that are broad concern categories rather than literal label terms (e.g.
  "Excessive Salt", "GMO Feed for Livestock"). They're seeded and editable in
  admin, but excluded from automatic scoring so they don't flag nearly every
  product.
- **found_in / example_brands / time_to_manifest** (new fields, not in your
  original schema) — kept from the spreadsheet's "Commonly Found In", "Specific
  Products/Brands", and "Time to Manifest" columns instead of discarding them.
- **source_note** — left blank; the spreadsheet had no citation column.

Two known near-duplicates in the source data were adjusted to prevent
double-counting the same ingredient under two rows: "Trans Fats / Partially
Hydrogenated Oils" no longer aliases to "Partially Hydrogenated Oils" (which is
already its own row), and "SO2" was kept as an alias only on "Sulfur Dioxide",
not also on "Sulfites".

## Scoring

Every product starts at 100. Each ingredient list is split into candidate
phrases (commas/semicolons/newlines, with parenthetical sub-lists flattened
too) and matched against chemical names/aliases — exact/substring match first,
then a small fuzzy (typo-tolerant) fallback. Each matched chemical (deduped, so
one substance is only counted once even if it matches multiple phrases)
subtracts: Tier 1 = 5 pts, Tier 2 = 15 pts, Tier 3 = 30 pts, floored at 0.
Verdict: 70-100 Clean, 40-69 Caution, 0-39 Avoid. See `src/lib/scoring.ts`.

## Cleaner alternatives (Open Food Facts)

When a product scores Caution or Avoid, the checker tries to find up to 5
Clean-scoring alternatives in the same category/country via the Open Food
Facts API. Category is auto-detected from the product name if given (matched
against a curated list in `src/lib/categories.ts`); otherwise a manual
dropdown is shown. Candidates are scored through *this app's own* chemical DB
and scoring engine, not Open Food Facts' own scores. If fewer than 3
Clean-scoring matches exist for the selected country, it shows "limited local
data" instead of forcing weak suggestions. See `src/lib/offClient.ts` and
`src/app/api/off/`.

## Photo-based scanning

Users can upload a photo of an ingredient panel instead of typing. The photo
is sent server-side to Claude's vision API (`src/lib/claudeVision.ts`, using
`ANTHROPIC_API_KEY` — never exposed to the browser) to extract the ingredient
text, which is shown in the editable textarea for the user to sanity-check
before scoring runs. See `src/app/api/scan-photo/route.ts`.

## Anonymous usage analytics

A plain-language notice (bottom of every page, `src/components/AnalyticsNotice.tsx`)
describes exactly what's collected before any tracking starts. Nothing is
logged until the user clicks "Got it" -- no session cookie is even created
before that. Once acknowledged:

- A random UUID is set in a `scanner_session` cookie (no login, name, or email
  tied to it).
- Events log to the `events` table: session ID, timestamp, the product name
  (or a SHA-256 hash of the ingredient list if it wasn't named -- the raw text
  is never stored in this table), the verdict shown, the action
  (`viewed` / `clicked_alternative` / `dismissed`), and the country the user
  picked from the existing dropdown (never GPS/precise location).
- No third-party analytics or ad scripts are used -- see `src/lib/analytics.ts`
  and `src/app/api/events/route.ts`.

"Clicked_alternative" fires when a suggested alternative (now a link to its
Open Food Facts product page) is clicked; "dismissed" fires from the new
"Clear results" button; "viewed" fires when a score result is shown.

## Not built (by request)

Payments, user accounts, city/location logic.
