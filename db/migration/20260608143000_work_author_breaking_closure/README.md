# Work Author Breaking Closure

This migration intentionally does not provide compatibility shims.

- Active author names become unique only while `deleted_at is null`; historical soft-deleted rows may keep reused names.
- `work_author_relation.work_id` and `author_id` become foreign keys.
- Existing live comic works must reference manga authors, and live novel works must reference novel authors before migration.
- Invalid data fails the migration before constraints are changed.

This repository's current hand-written closure migrations are stored as `migration.sql` plus local notes without Drizzle snapshot artifacts; the production runner consumes `migration.sql` directly.
