-- Case-insensitive uniqueness on chemicals.name.
-- Prisma's schema DSL can't express a functional (LOWER()) unique index, so
-- this is applied directly via `prisma db execute` rather than modeled in
-- schema.prisma. Run this once against the database (idempotent).
--
-- Prevents the race condition where two near-simultaneous scans hitting the
-- same unmatched ingredient each pass the gap-finder's dedup check before
-- either suggestion is written, producing two pending suggestions for the
-- same chemical that could both later be approved into duplicate rows.
CREATE UNIQUE INDEX IF NOT EXISTS chemicals_name_lower_unique_idx
  ON chemicals (LOWER(name));
