# Canonical Empty-Database Baseline Migration — Execution Plan

> **Execution model:** perform each step in order; do not retain or repair the
> discarded migration history.

**Goal:** Replace `db/migration` with one Drizzle-generated baseline that can
initialize the current schema from an empty PostgreSQL `public` schema.

**Architecture:** `db/schema/index.ts` is the sole schema input. Drizzle Kit
generates the baseline and its metadata in an isolated directory first. After
inspection, that output replaces the canonical migration directory. A small
hand-authored extension prerequisite is inserted before generated GIN trigram
indexes. `db/migrate.ts` then applies only this baseline through the existing
script.

**Constraints:** This is a hard cut. Do not preserve old migration files,
compatibility views, data transforms, adapters, or migration-history aliases.
The `foo` database may be reset and is the only integration-test target.

---

## 1. Capture the migration boundary and generation input

**Files:**

- Modify: `docs/superpowers/specs/2026-07-14-canonical-empty-db-baseline-design.md`
- Inspect: `db/schema/index.ts`, `drizzle.config.ts`, `db/migrate.ts`

1. Confirm the database is empty and that `db/migrate.ts` targets its standard
   `__drizzle_migrations__` journal.
2. Confirm that the schema contains trigram operator-class indexes and hence
   requires `pg_trgm` ahead of the generated DDL.
3. Keep the design record as the operational contract for this destructive
   baseline replacement.

## 2. Generate a candidate baseline outside the canonical directory

**Files:**

- Create temporarily: `.omx/baseline-generation/drizzle.config.ts`
- Generate temporarily: `.omx/baseline-generation/migration/**`

1. Point the temporary config at `db/schema/index.ts` with an otherwise empty
   `out` directory.
2. Run `pnpm exec drizzle-kit generate --config <temporary-config>`.
3. Inspect the produced SQL and metadata: it must contain the current tables,
   constraints, and relation-derived foreign keys without references to old
   migration files.
4. Stop here if generation fails; the old history must not be deleted until a
   complete candidate exists.

## 3. Replace the migration history atomically at repository scope

**Files:**

- Delete: `db/migration/**` (all existing incremental history)
- Add: `db/migration/<generated-baseline>/migration.sql`
- Add: `db/migration/<generated-baseline>/meta/**`
- Add: `db/migration/<generated-baseline>/README.md`

1. Verify the resolved deletion target is exactly the repository's
   `db/migration` directory.
2. Remove every old migration directory, including the prior hard-cut cleanup
   migration and its READMEs.
3. Move the inspected generated candidate into `db/migration` unchanged.
4. Insert `CREATE EXTENSION IF NOT EXISTS pg_trgm;` before the generated DDL so
   the baseline owns all database capabilities it requires.
5. Add a concise README that states the empty-database-only contract and the
   explicit reset/restore recovery boundary.

## 4. Align operational documentation

**Files:**

- Modify: `.trae/rules/07-drizzle-operations.md`
- Modify: `README.md`

1. Describe `pnpm db:migrate` as the sole migration command.
2. State that this migration line initializes an empty `public` schema only.
3. State that existing databases are restored/reset outside the migration
   command; no in-place compatibility path exists.

## 5. Validate the hard cut end to end

**Files:** none expected

1. Run `pnpm db:migration:check` against the new one-migration directory.
2. Run `pnpm db:migrate` against the empty local `foo` database.
3. Query PostgreSQL to verify the migration journal has exactly one entry, the
   expected application tables exist, and `pg_trgm` is installed.
4. Run `pnpm exec prettier --check` for changed Markdown files and
   `pnpm type-check`.
5. Remove the temporary generation configuration/output after successful
   verification. Report the exact hard-cut effects and validation evidence.
