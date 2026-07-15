# Canonical empty-database baseline

This is the only Drizzle migration line for the current epoch. It initializes
only a registered disposable target classified as `NEW`; exact current targets
are classified as `CURRENT` and remain write-free.

`migration.sql` creates `pg_trgm` version `1.6` explicitly in `public` before
the first trigram dependency. The migration role owns the extension, journal,
relations, and sequences represented as `$MIGRATION_ROLE` in the canonical
catalog manifest.

Apply it exclusively through:

```bash
pnpm db:migrate
```

Use `pnpm db:migrate:preflight` for the connected, read-only classifier. Use
`pnpm db:migrate -- --check-env` for configuration-only validation; that mode
does not open a database connection.

The sole catalog artifact is `catalog-manifest.json`. Only the registered
generation target may rebuild it with `pnpm db:catalog:generate`; all sealed and
cutover gates use `pnpm db:catalog:check`. The manifest includes the complete
public catalog, generated comments, frozen epoch policy, and normalized owner
contract. It intentionally excludes target endpoint, database name, role name,
role OID, and system identifier.

There is no in-place upgrade, old-journal reader, data conversion, partial
rollback, or down migration. Recovery selects one complete epoch bundle; a
partially initialized disposable generation or Gate-B target is destroyed and
rebuilt from empty.
