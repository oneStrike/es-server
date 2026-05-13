CREATE TABLE "background_task" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "task_id" varchar(36) NOT NULL,
  "task_type" varchar(120) NOT NULL,
  "status" smallint NOT NULL,
  "payload" jsonb NOT NULL,
  "progress" jsonb NOT NULL,
  "result" jsonb,
  "error" jsonb,
  "residue" jsonb,
  "rollback_error" jsonb,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "max_retries" integer DEFAULT 3 NOT NULL,
  "cancel_requested_at" timestamp(6) with time zone,
  "claimed_by" varchar(120),
  "claim_expires_at" timestamp(6) with time zone,
  "started_at" timestamp(6) with time zone,
  "finalizing_at" timestamp(6) with time zone,
  "finished_at" timestamp(6) with time zone,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL,
  CONSTRAINT "background_task_task_id_key" UNIQUE("task_id"),
  CONSTRAINT "background_task_status_valid_chk" CHECK ("status" in (1, 2, 3, 4, 5, 6, 7)),
  CONSTRAINT "background_task_retry_count_non_negative_chk" CHECK ("retry_count" >= 0),
  CONSTRAINT "background_task_max_retries_non_negative_chk" CHECK ("max_retries" >= 0)
);

CREATE INDEX "background_task_task_type_status_created_at_id_idx"
  ON "background_task" USING btree ("task_type", "status", "created_at", "id");

CREATE INDEX "background_task_status_created_at_id_idx"
  ON "background_task" USING btree ("status", "created_at", "id");

CREATE INDEX "background_task_processing_claim_expires_at_idx"
  ON "background_task" USING btree ("status", "claim_expires_at");

CREATE INDEX "background_task_updated_at_id_idx"
  ON "background_task" USING btree ("updated_at" DESC NULLS LAST, "id" DESC NULLS LAST);
