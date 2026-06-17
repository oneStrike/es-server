# Work Chapter Content Breaking Audit Guard

This migration is a pre-guard for
`20260611120000_database_breaking_realtime_repair`. It keeps that destructive
cutover strict while preserving comic chapter `content` values that cannot be
mapped into the target `comic_content_manifest` JSON array.

## What changes

- Creates migration-owned table `work_chapter_content_breaking_audit`.
- Audits non-blank comic `work_chapter.content` values that are not valid JSON
  arrays.
- Sets only those audited comic `content` values to `NULL` so the following
  strict destructive migration can run without silently converting invalid
  legacy text into target runtime fields.
- Does nothing to runtime schema contracts and adds no runtime compatibility
  path.

The audit table is an operational artifact for the cutover. Application runtime
code must not read it or depend on it.

## Ordering

The timestamp intentionally sorts immediately before
`20260611120000_database_breaking_realtime_repair`, because that later migration
drops `work_chapter.content`. If an environment has already applied the later
migration, this guard still creates the audit table and then no-ops because the
legacy `content` column is gone; already dropped values cannot be reconstructed
by this follow-up.

## Release Check

Run `reconcile.sql` before the hard cutover. The
`invalid_comic_content_count` value names how many comic chapters will be
preserved in `work_chapter_content_breaking_audit` and normalized to `NULL`
before `work_chapter.content` is dropped.
