# Coupon admin grant workflow

This migration adds the domain tables used by the admin batch coupon grant workflow.

## What changes

- Adds `coupon_admin_grant_job`, keyed by `workflow_job_id` and `operation_id`, so admin submissions have a durable idempotency contract before workflow confirmation.
- Adds `coupon_admin_grant_item`, one row per selected APP user, so workers can process bounded per-user chunks, retry failures, and skip unprocessed users on cancellation.
- Adds the job/status/updated/id index used by the worker item claim page and the user/created index used by support lookups.
- Keeps schema aligned with `db/schema/app/coupon-admin-grant-job.ts` and `db/schema/app/coupon-admin-grant-item.ts`.

## Generation note

`pnpm db:generate` was attempted in this non-interactive Codex shell and stopped with:

```text
Interactive prompts require a TTY terminal
```

The same failure occurred when passing `--name coupon_admin_grant_workflow`. Per `.trae/rules/07-drizzle.md`, this migration was written by hand and limited to the new tables, indexes, unique constraints, and check constraints represented in schema.

## Large table note

Both tables are new, so no historical backfill or online index workaround is required. The migration uses regular `CREATE INDEX` statements because Drizzle migrator runs migration files transactionally.
