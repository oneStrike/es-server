DO $$
DECLARE
  invalid_rows text;
BEGIN
  SELECT string_agg(
    format(
      'task_id=%s claim_mode=%s step_id=%s trigger_mode=%s',
      invalid.task_id,
      invalid.claim_mode,
      invalid.step_id,
      invalid.trigger_mode
    ),
    '; '
  )
  INTO invalid_rows
  FROM (
    SELECT
      d.id AS task_id,
      d.claim_mode,
      s.id AS step_id,
      s.trigger_mode
    FROM task_definition d
    JOIN task_step s ON s.task_id = d.id
    WHERE d.deleted_at IS NULL
      AND (
        (d.claim_mode = 1 AND s.trigger_mode <> 2)
        OR (d.claim_mode = 2 AND s.trigger_mode <> 1)
      )
    ORDER BY d.id, s.id
    LIMIT 20
  ) invalid;

  IF invalid_rows IS NOT NULL THEN
    RAISE EXCEPTION 'task execution mode matrix contains illegal rows: %', invalid_rows;
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_event_failure" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "idempotency_key" varchar(255) NOT NULL,
  "event_key" varchar(80) NOT NULL,
  "event_biz_key" varchar(180) NOT NULL,
  "event_code" integer NOT NULL,
  "template_key" varchar(80),
  "user_id" integer NOT NULL,
  "target_type" varchar(80),
  "target_id" integer,
  "status" smallint DEFAULT 1 NOT NULL,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "last_retry_at" timestamp(6) with time zone,
  "last_error_message" varchar(1000),
  "resolved_at" timestamp(6) with time zone,
  "terminal_error_at" timestamp(6) with time zone,
  "terminal_reason" varchar(500),
  "processing_token" varchar(64),
  "processing_started_at" timestamp(6) with time zone,
  "processing_expired_at" timestamp(6) with time zone,
  "request_payload" jsonb NOT NULL,
  "occurred_at" timestamp(6) with time zone NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL,
  "deleted_at" timestamp(6) with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "task_event_failure_idempotency_key_key"
  ON "task_event_failure" ("idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_event_failure_status_created_at_idx"
  ON "task_event_failure" ("status", "created_at" DESC, "id" DESC)
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_event_failure_event_key_biz_key_idx"
  ON "task_event_failure" ("event_key", "event_biz_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_event_failure_user_created_at_idx"
  ON "task_event_failure" ("user_id", "created_at" DESC, "id" DESC)
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_instance_live_task_created_idx"
  ON "task_instance" ("task_id", "created_at" DESC, "id" DESC)
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "task_event_failure"
    ADD CONSTRAINT "task_event_failure_idempotency_key_not_blank_chk"
    CHECK (btrim("idempotency_key") <> '');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "task_event_failure"
    ADD CONSTRAINT "task_event_failure_event_key_not_blank_chk"
    CHECK (btrim("event_key") <> '');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "task_event_failure"
    ADD CONSTRAINT "task_event_failure_event_biz_key_not_blank_chk"
    CHECK (btrim("event_biz_key") <> '');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "task_event_failure"
    ADD CONSTRAINT "task_event_failure_event_code_positive_chk"
    CHECK ("event_code" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "task_event_failure"
    ADD CONSTRAINT "task_event_failure_template_key_not_blank_chk"
    CHECK ("template_key" IS NULL OR btrim("template_key") <> '');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "task_event_failure"
    ADD CONSTRAINT "task_event_failure_user_id_positive_chk"
    CHECK ("user_id" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "task_event_failure"
    ADD CONSTRAINT "task_event_failure_target_type_not_blank_chk"
    CHECK ("target_type" IS NULL OR btrim("target_type") <> '');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "task_event_failure"
    ADD CONSTRAINT "task_event_failure_target_id_positive_chk"
    CHECK ("target_id" IS NULL OR "target_id" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "task_event_failure"
    ADD CONSTRAINT "task_event_failure_status_valid_chk"
    CHECK ("status" IN (1, 2, 3, 4));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "task_event_failure"
    ADD CONSTRAINT "task_event_failure_retry_count_non_negative_chk"
    CHECK ("retry_count" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "task_event_failure"
    ADD CONSTRAINT "task_event_failure_processing_token_not_blank_chk"
    CHECK ("processing_token" IS NULL OR btrim("processing_token") <> '');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "task_event_failure"
    ADD CONSTRAINT "task_event_failure_processing_lease_pair_chk"
    CHECK (
      ("processing_token" IS NULL AND "processing_started_at" IS NULL AND "processing_expired_at" IS NULL)
      OR ("processing_token" IS NOT NULL AND "processing_started_at" IS NOT NULL AND "processing_expired_at" IS NOT NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
