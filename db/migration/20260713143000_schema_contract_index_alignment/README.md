# Schema contract and index alignment

This append-only migration aligns the physical PostgreSQL schema with the
current Drizzle owners. It was written manually because `pnpm db:generate`
requires an interactive TTY in this environment.

## Data guard

Before adding the new polymorphic-reference and audit-pair checks, the
migration stops if historical rows violate the new closed contracts. It does
not silently rewrite business references or audit history.

`sys_dictionary_item.sort_order` is the sole deterministic backfill: existing
nulls become `0` before the column becomes `integer NOT NULL DEFAULT 0`.

## Operational path

The repository only permits migrations against a registered disposable target:

```bash
pnpm db:migrate -- --mode active --target-id <registered-local-target>
```

The migration contains ordinary transactional index operations. For a large
production-like disposable dataset, estimate lock and I/O impact before the
run; do not bypass the registered-target guard with direct database commands.

## Scope

- Adds the missing closed-domain and paired-audit check constraints.
- Converts the migration-audit key to the schema-declared composite primary key.
- Replaces the dictionary serial sort column with the declared integer contract.
- Removes redundant indexes, rebuilds stable cursor indexes, and creates the
  missing query-shaped indexes.
- Renames equivalent constraint and index identifiers without changing their
  predicates or columns.
