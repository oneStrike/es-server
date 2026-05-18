ALTER TABLE "content_import_item"
  ADD COLUMN "next_retry_at" timestamp(6) with time zone,
  ADD COLUMN "auto_retry_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "max_auto_retries" integer DEFAULT 3 NOT NULL,
  ADD COLUMN "last_retry_reason" varchar(500),
  ADD COLUMN "last_retry_code" varchar(120);

CREATE INDEX "content_import_item_job_status_next_retry_idx"
  ON "content_import_item" ("content_import_job_id", "status", "next_retry_at", "id");

ALTER TABLE "content_import_item"
  ADD CONSTRAINT "content_import_item_auto_retry_count_non_negative_chk"
  CHECK ("auto_retry_count" >= 0);

ALTER TABLE "content_import_item"
  ADD CONSTRAINT "content_import_item_max_auto_retries_non_negative_chk"
  CHECK ("max_auto_retries" >= 0);

ALTER TABLE "content_import_item_attempt"
  DROP CONSTRAINT "content_import_item_attempt_status_valid_chk";

ALTER TABLE "content_import_item_attempt"
  ADD CONSTRAINT "content_import_item_attempt_status_valid_chk"
  CHECK ("status" in (1, 2, 3, 4, 5, 6));

ALTER TABLE "workflow_attempt"
  ADD COLUMN "not_before_at" timestamp(6) with time zone;

CREATE INDEX "workflow_attempt_status_not_before_created_at_id_idx"
  ON "workflow_attempt" ("status", "not_before_at", "created_at", "id");
