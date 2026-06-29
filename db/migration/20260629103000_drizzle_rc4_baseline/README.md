# Drizzle RC4 Baseline Migration

This migration is a no-op database baseline for the Drizzle ORM 1.0 RC upgrade.

The repository's recent migrations are hand-written `migration.sql` directories
without Drizzle snapshot artifacts. With `drizzle-kit@1.0.0-rc.3`, `pnpm
db:generate` enters an interactive rename/move prompt in this non-TTY
environment because there is no previous generated snapshot to diff from.

`migration.sql` intentionally performs no schema or data change. Its only runtime
effect is allowing the Drizzle migrator to record the migration as applied. The
paired `snapshot.json` was generated from the current `db/schema/index.ts` public
schema through `drizzle-kit/api-postgres.generateDrizzleJson`, so future schema
changes can be generated from a current baseline instead of the legacy
hand-written history.

Operational impact:

- No table DDL, data rewrite, backfill, or index creation.
- No application contract change.
- No special maintenance window beyond the normal migration table write.
