ALTER TABLE "growth_reward_settlement"
  ADD COLUMN IF NOT EXISTS "processing_token" varchar(64);
--> statement-breakpoint
ALTER TABLE "growth_reward_settlement"
  ADD COLUMN IF NOT EXISTS "processing_started_at" timestamp(6) with time zone;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "growth_reward_settlement"
    ADD CONSTRAINT "growth_reward_settlement_processing_token_not_blank_chk"
    CHECK ("processing_token" IS NULL OR btrim("processing_token") <> '');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "growth_reward_settlement"
    ADD CONSTRAINT "growth_reward_settlement_processing_lease_pair_chk"
    CHECK (
      ("processing_token" IS NULL AND "processing_started_at" IS NULL)
      OR ("processing_token" IS NOT NULL AND "processing_started_at" IS NOT NULL)
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_definition_created_at_idx"
  ON "task_definition" ("created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_definition_active_manual_lookup_idx"
  ON "task_definition" ("scene_type", "sort_order", "id")
  WHERE "deleted_at" IS NULL AND "status" = 1 AND "claim_mode" = 2;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_instance_user_task_cycle_live_idx"
  ON "task_instance" ("user_id", "task_id", "cycle_key")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_instance_live_created_at_idx"
  ON "task_instance" ("created_at" DESC, "id" DESC)
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_instance_live_user_status_created_idx"
  ON "task_instance" ("user_id", "status", "created_at" DESC, "id" DESC)
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_instance_reward_retry_scan_idx"
  ON "task_instance" ("status", "reward_applicable", "id" DESC)
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_event_log_instance_latest_idx"
  ON "task_event_log" ("instance_id", "occurred_at" DESC, "created_at" DESC)
  WHERE "instance_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_step_unique_fact_reconcile_summary_idx"
  ON "task_step_unique_fact" ("task_id", "user_id", "scope_key", "step_id", "first_occurred_at" DESC);
