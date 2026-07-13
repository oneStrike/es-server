# Task Admin/Service Repair Indexes

This migration adds query-shaped indexes for the task admin/service repair pass
and the task reward settlement execution lease columns used to prevent
concurrent reward retry side effects.

Settlement execution lease:

- `growth_reward_settlement.processing_token`: per-attempt claim token.
- `growth_reward_settlement.processing_started_at`: lease start time.
- `growth_reward_settlement_processing_lease_pair_chk`: token and timestamp are
  both null or both present.

Owner queries:

- `task_definition_created_at_idx`: admin task definition date-range filtering by `created_at`.
- `task_definition_active_manual_lookup_idx`: app available-task candidate scan before user claimability anti-join.
- `task_instance_user_task_cycle_live_idx`: available-task anti-join by `user_id`, `task_id`, and `cycle_key`.
- `task_instance_live_created_at_idx`: admin instance/reconciliation list ordering and created-date filters.
- `task_instance_live_user_status_created_idx`: admin/user summary and common instance filters.
- `task_instance_reward_retry_scan_idx`: task reward retry batch scan over completed reward-applicable instances.
- `task_event_log_instance_latest_idx`: reconciliation latest-event window query by instance.
- `task_step_unique_fact_reconcile_summary_idx`: reconciliation unique-fact summary by task/user/scope/step.

`pnpm db:migrate -- --mode active --target-id <registered-local-target>` runs
migrations through the guarded Drizzle migrator against registered disposable
targets only, so the checked-in SQL uses normal `CREATE INDEX IF NOT EXISTS`
statements. For a large disposable production-like dataset, create these
indexes manually with `CONCURRENTLY` outside the migration transaction first,
then apply this migration during a maintenance window so the statements are
no-ops.

Rollback:

```sql
DROP INDEX CONCURRENTLY IF EXISTS "task_definition_created_at_idx";
DROP INDEX CONCURRENTLY IF EXISTS "task_definition_active_manual_lookup_idx";
DROP INDEX CONCURRENTLY IF EXISTS "task_instance_user_task_cycle_live_idx";
DROP INDEX CONCURRENTLY IF EXISTS "task_instance_live_created_at_idx";
DROP INDEX CONCURRENTLY IF EXISTS "task_instance_live_user_status_created_idx";
DROP INDEX CONCURRENTLY IF EXISTS "task_instance_reward_retry_scan_idx";
DROP INDEX CONCURRENTLY IF EXISTS "task_event_log_instance_latest_idx";
DROP INDEX CONCURRENTLY IF EXISTS "task_step_unique_fact_reconcile_summary_idx";
ALTER TABLE "growth_reward_settlement"
  DROP CONSTRAINT IF EXISTS "growth_reward_settlement_processing_lease_pair_chk";
ALTER TABLE "growth_reward_settlement"
  DROP CONSTRAINT IF EXISTS "growth_reward_settlement_processing_token_not_blank_chk";
ALTER TABLE "growth_reward_settlement" DROP COLUMN IF EXISTS "processing_started_at";
ALTER TABLE "growth_reward_settlement" DROP COLUMN IF EXISTS "processing_token";
```
