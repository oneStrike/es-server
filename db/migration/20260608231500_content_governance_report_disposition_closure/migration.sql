ALTER TABLE "user_report"
  ADD COLUMN IF NOT EXISTS "target_action" smallint DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS "target_action_reason" varchar(500),
  ADD COLUMN IF NOT EXISTS "target_action_status" smallint DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS "target_action_result" jsonb,
  ADD COLUMN IF NOT EXISTS "target_action_applied_at" timestamp(6) with time zone;
--> statement-breakpoint
UPDATE "user_report"
SET
  "target_action" = 1,
  "target_action_status" = 3,
  "target_action_result" = jsonb_build_object('legacy_no_disposition', true),
  "target_action_applied_at" = NULL
WHERE "status" IN (3, 4)
  AND "target_action_status" = 1
  AND "target_action_result" IS NULL;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "user_report"
    DROP CONSTRAINT IF EXISTS "user_report_target_action_valid_chk";
  ALTER TABLE "user_report"
    ADD CONSTRAINT "user_report_target_action_valid_chk"
    CHECK ("target_action" IN (1,2,3,4,5,6,7));

  ALTER TABLE "user_report"
    DROP CONSTRAINT IF EXISTS "user_report_target_action_status_valid_chk";
  ALTER TABLE "user_report"
    ADD CONSTRAINT "user_report_target_action_status_valid_chk"
    CHECK ("target_action_status" IN (1,2,3));
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_report_disposition_attempt" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "report_id" integer NOT NULL,
  "target_action" smallint NOT NULL,
  "attempt_status" smallint NOT NULL,
  "failure_code" varchar(120),
  "failure_message" varchar(500),
  "retryable" boolean DEFAULT true NOT NULL,
  "actor_user_id" integer NOT NULL,
  "attempted_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp(6) with time zone,
  "result" jsonb,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "user_report_disposition_attempt"
    DROP CONSTRAINT IF EXISTS "user_report_disposition_attempt_action_valid_chk";
  ALTER TABLE "user_report_disposition_attempt"
    ADD CONSTRAINT "user_report_disposition_attempt_action_valid_chk"
    CHECK ("target_action" IN (1,2,3,4,5,6,7));

  ALTER TABLE "user_report_disposition_attempt"
    DROP CONSTRAINT IF EXISTS "user_report_disposition_attempt_status_valid_chk";
  ALTER TABLE "user_report_disposition_attempt"
    ADD CONSTRAINT "user_report_disposition_attempt_status_valid_chk"
    CHECK ("attempt_status" IN (1,2));
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_report_target_created_at_id_idx"
  ON "user_report" ("target_type", "target_id", "created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_report_status_created_at_id_idx"
  ON "user_report" ("status", "created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_report_reporter_created_at_id_idx"
  ON "user_report" ("reporter_id", "created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_report_handler_status_created_at_id_idx"
  ON "user_report" ("handler_id", "status", "created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_report_disposition_status_created_at_id_idx"
  ON "user_report" ("target_action_status", "created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_report_disposition_attempt_report_created_at_idx"
  ON "user_report_disposition_attempt" ("report_id", "created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_report_disposition_attempt_status_created_at_idx"
  ON "user_report_disposition_attempt" ("attempt_status", "created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_report_disposition_attempt_failed_latest_idx"
  ON "user_report_disposition_attempt" ("report_id", "created_at" DESC, "id" DESC)
  WHERE "attempt_status" = 1 AND "resolved_at" IS NULL;
