# Coupon definition review constraints and indexes

This migration closes the DB side of the coupon definition review fixes.

## What changes

- Changes the default `coupon_definition.valid_days` for new DB-level inserts from `0` to `7`.
- Keeps historical `valid_days = 0` rows valid because legacy instances still use `0` as instance-controlled expiry.
- Adds coupon ability-matrix check constraints mirroring `CouponService.assertCouponAbility()`. The executable migration uses `NOT VALID` plus `VALIDATE CONSTRAINT` so the constraint-add step does not scan the table under the strongest lock.
- Adds `coupon_definition_created_at_idx` for admin definition date range filtering.
- Adds `user_coupon_instance_user_available_type_created_idx` for user coupon list filtering by user/status/type and `created_at DESC`.

## Generation note

`pnpm db:generate` was attempted in this non-interactive Codex shell and stopped with:

```text
Interactive prompts require a TTY terminal
```

Per `.trae/rules/07-drizzle.md`, this migration was therefore written by hand and kept aligned with `db/schema`.

## Required preflight

Run this report before applying the migration in staging or production:

```sql
SELECT
  "id",
  "coupon_type",
  "target_scope",
  "usage_limit",
  "discount_amount",
  "discount_rate_bps",
  "benefit_days",
  "benefit_count"
FROM "coupon_definition"
WHERE ("coupon_type" = 1 AND NOT ("target_scope" = 1 AND "usage_limit" >= 1))
   OR ("coupon_type" = 2 AND NOT ("target_scope" = 1 AND ("discount_amount" > 0 OR "discount_rate_bps" < 10000)))
   OR ("coupon_type" = 3 AND NOT ("target_scope" = 2 AND "benefit_days" >= 1))
   OR ("coupon_type" = 4 AND NOT ("target_scope" = 3 AND "benefit_count" >= 1));
```

If any rows are returned, stop rollout and clean or backfill those rows first. The executable migration repeats this guard and raises before adding constraints.

The migration validates the constraints after adding them. On large `coupon_definition` tables, schedule this migration during a maintenance window if the validation scan is expected to be material.

## Large table online path

`db:migrate:prod` uses Drizzle migrator and `db:migrate` uses `drizzle-kit migrate`; the checked-in SQL therefore uses regular `CREATE INDEX IF NOT EXISTS` rather than `CREATE INDEX CONCURRENTLY`. For large production tables, run the two index statements below manually outside the migration transaction before this migration, then apply the migration during a maintenance window. The `IF NOT EXISTS` statements in the migration will then be no-ops for those indexes.

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "coupon_definition_created_at_idx"
  ON "coupon_definition" ("created_at" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "user_coupon_instance_user_available_type_created_idx"
  ON "user_coupon_instance" ("user_id", "status", "coupon_type", "created_at" DESC)
  WHERE "remaining_uses" > 0;
```

## EXPLAIN follow-up

No executable target database was available while creating this migration. Before production rollout, compare representative plans:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM "user_coupon_instance"
WHERE "user_id" = :user_id
  AND "status" = 1
  AND "remaining_uses" > 0
  AND ("expires_at" IS NULL OR "expires_at" > now())
  AND "coupon_type" = :coupon_type
ORDER BY "created_at" DESC
LIMIT :limit OFFSET :offset;

EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM "coupon_definition"
WHERE "created_at" >= :start_at
  AND "created_at" < :end_at
ORDER BY "id" DESC
LIMIT :limit OFFSET :offset;
```
