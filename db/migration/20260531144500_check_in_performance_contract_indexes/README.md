# Check-in performance contract indexes

This migration closes the check-in DB/index part of the approved performance contract plan.

## What changes

- Drops URL/icon lookup indexes that were created for display payload fields but are not used as query predicates.
- Keeps every URL/icon column and display payload field intact.
- Adds `check_in_streak_progress_active_leaderboard_idx` for the current leaderboard query:
  - predicate: `current_streak > 0`;
  - active filter at runtime: `last_signed_date IN (:today, :yesterday)`;
  - order: `current_streak DESC, last_signed_date DESC, id ASC`.
- Adds `check_in_streak_grant_trigger_sign_date_idx` for the admin calendar overview
  aggregate query over global streak grant trigger counts by date range.

## Default path

`db/migrate.ts` uses Drizzle's node-postgres migrator, which runs pending migrations inside a transaction. The checked-in `migration.sql` therefore uses normal `DROP INDEX IF EXISTS` and `CREATE INDEX IF NOT EXISTS` statements and is suitable for a maintenance window.

## Large table online path

For large production tables, run the same index operations manually with `CONCURRENTLY` outside Drizzle migration transaction, then apply or mark this migration during a window where no index DDL remains to execute.

Use a dedicated database session:

```sql
SET lock_timeout = '5s';
SET statement_timeout = '30min';

DROP INDEX CONCURRENTLY IF EXISTS "check_in_config_makeup_icon_url_idx";
DROP INDEX CONCURRENTLY IF EXISTS "check_in_config_reward_overview_icon_url_idx";
DROP INDEX CONCURRENTLY IF EXISTS "check_in_record_reward_overview_icon_url_idx";
DROP INDEX CONCURRENTLY IF EXISTS "check_in_streak_rule_reward_overview_icon_url_idx";
DROP INDEX CONCURRENTLY IF EXISTS "check_in_streak_grant_reward_overview_icon_url_idx";
DROP INDEX CONCURRENTLY IF EXISTS "check_in_streak_rule_reward_item_icon_url_idx";
DROP INDEX CONCURRENTLY IF EXISTS "check_in_streak_grant_reward_item_icon_url_idx";

CREATE INDEX CONCURRENTLY IF NOT EXISTS "check_in_streak_progress_active_leaderboard_idx"
  ON "check_in_streak_progress" ("current_streak" DESC, "last_signed_date" DESC, "id")
  WHERE "current_streak" > 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "check_in_streak_grant_trigger_sign_date_idx"
  ON "check_in_streak_grant" ("trigger_sign_date");
```

If a concurrent index build fails, PostgreSQL may leave an invalid index. Inspect and clean it before retrying:

```sql
SELECT indexrelid::regclass AS index_name, indisvalid, indisready
FROM pg_index
WHERE indexrelid::regclass::text IN (
  'check_in_streak_progress_active_leaderboard_idx',
  'check_in_streak_grant_trigger_sign_date_idx'
);

DROP INDEX CONCURRENTLY IF EXISTS "check_in_streak_progress_active_leaderboard_idx";
DROP INDEX CONCURRENTLY IF EXISTS "check_in_streak_grant_trigger_sign_date_idx";
```

## EXPLAIN follow-up

No executable target database was available while creating this migration. Per the approved PRD, the migration uses the order-shaped default index because it matches the leaderboard `ORDER BY`.

Before production rollout, compare:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM "check_in_streak_progress"
WHERE "current_streak" > 0
  AND "last_signed_date" IN (:today, :yesterday)
ORDER BY "current_streak" DESC, "last_signed_date" DESC, "id" ASC
LIMIT :limit OFFSET :offset;
```

against a date-leading candidate if active-row cardinality makes the date filter more selective:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "check_in_streak_progress_active_leaderboard_date_idx"
  ON "check_in_streak_progress" ("last_signed_date", "current_streak" DESC, "id")
  WHERE "current_streak" > 0;
```

Only keep the date-leading candidate if EXPLAIN proves it is cheaper after accounting for any extra sort.

The admin overview aggregate endpoint now uses date-range grouped aggregates:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT
  "sign_date",
  count(distinct "user_id")::int AS "signedCount",
  count(distinct CASE WHEN "record_type" = 1 THEN "user_id" END)::int AS "normalSignCount",
  count(distinct CASE WHEN "record_type" = 2 THEN "user_id" END)::int AS "makeupSignCount"
FROM "check_in_record"
WHERE "sign_date" BETWEEN :period_start AND :cutoff
GROUP BY "sign_date"
ORDER BY "sign_date" ASC;
```

`check_in_record_sign_date_idx` already supports the record-side date range. The grant-side
aggregate is global by trigger date, so the existing `(user_id, trigger_sign_date)` index is
not a good leading-column match; this migration adds the date-leading grant index:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT
  "trigger_sign_date",
  count("id")::int AS "streakRewardTriggerCount"
FROM "check_in_streak_grant"
WHERE "trigger_sign_date" BETWEEN :period_start AND :cutoff
GROUP BY "trigger_sign_date"
ORDER BY "trigger_sign_date" ASC;
```
