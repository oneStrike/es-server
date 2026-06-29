-- No-op baseline migration for the Drizzle ORM 1.0 RC upgrade.
-- The schema is unchanged; this statement lets Drizzle record the baseline
-- migration while the paired snapshot.json gives future generate runs a
-- current schema snapshot to diff against.
SELECT 1;
