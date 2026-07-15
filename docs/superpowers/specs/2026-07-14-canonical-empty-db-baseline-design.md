# Canonical Empty-Database Baseline Design

## Decision

Replace the incremental `db/migration` history with one generated, canonical
baseline migration for the current `db/schema/index.ts` schema. The migration
line is intentionally valid only for a PostgreSQL database whose `public`
schema is empty.

This is a breaking operational change approved for the local database reset:

- all existing migration directories are removed;
- the historical data-cleanup and compatibility migrations are removed;
- no legacy schema, compatibility view, adapter, dual read/write, or staged
  cutover migration remains;
- pre-existing databases must be replaced from a backup or explicitly reset;
  they cannot join this migration line in place.

## Baseline Contents

`drizzle-kit generate` will create the single authoritative schema migration
from `db/schema/index.ts`. The checked-in SQL and Drizzle metadata produced by
that command are the source of truth for schema bootstrap.

The schema defines GIN indexes that use `gin_trgm_ops`, but Drizzle schema
generation does not model PostgreSQL extension creation. The baseline SQL must
therefore create `pg_trgm` before any index that uses that operator class. This
is a capability prerequisite, not a compatibility layer.

## Runtime Contract

`pnpm db:migrate` remains the only migration entry point. On a fresh database
it creates the baseline tables, constraints, indexes, and migration journal in
one migration run. On a database that already has application tables but no
matching journal, it must fail rather than attempting inference or repair.

Reference data is intentionally outside this contract and is applied only by
the explicit seed/bootstrap commands. Schema migration never fabricates or
transforms historical business data.

## Validation

The local `foo` database is the disposable integration target authorized for
reset. Validation consists of:

1. confirming the old history cannot initialize an empty schema (the observed
   red result);
2. generating the new baseline in an isolated temporary output directory;
3. replacing the canonical migration directory only after generation succeeds;
4. running migration-integrity checks and `pnpm db:migrate` on the empty
   database;
5. inspecting the resulting catalog for the migration journal, tables, and
   `pg_trgm` extension; and
6. running the repository type check and relevant documentation formatting
   checks.

No persistent test files are introduced; the repository contract prohibits
them, and the disposable database migration is the direct integration test for
this generated artifact.

## Recovery Boundary

There is no down migration and no automatic upgrade path from the discarded
history. Recovery is an operational restore/reset: restore a database backup
that belongs to the old line, or reset an approved database and initialize it
from this baseline. That explicit boundary prevents hidden compatibility debt.
