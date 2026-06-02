CREATE TABLE "coupon_admin_grant_job" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "workflow_job_id" bigint NOT NULL,
  "coupon_definition_id" integer NOT NULL,
  "operation_id" varchar(120) NOT NULL,
  "operation_hash" varchar(64) NOT NULL,
  "payload_hash" varchar(64) NOT NULL,
  "operator_user_id" integer NOT NULL,
  "per_user_quantity" integer NOT NULL,
  "selected_user_count" integer NOT NULL,
  "requested_grant_count" integer NOT NULL,
  "remark" varchar(500),
  "coupon_snapshot" jsonb NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coupon_admin_grant_job"
  ADD CONSTRAINT "coupon_admin_grant_job_workflow_job_id_key"
  UNIQUE ("workflow_job_id");
--> statement-breakpoint
ALTER TABLE "coupon_admin_grant_job"
  ADD CONSTRAINT "coupon_admin_grant_job_operation_id_key"
  UNIQUE ("operation_id");
--> statement-breakpoint
CREATE INDEX "coupon_admin_grant_job_workflow_job_id_idx"
  ON "coupon_admin_grant_job" ("workflow_job_id");
--> statement-breakpoint
CREATE INDEX "coupon_admin_grant_job_coupon_definition_created_at_idx"
  ON "coupon_admin_grant_job" ("coupon_definition_id", "created_at" DESC);
--> statement-breakpoint
ALTER TABLE "coupon_admin_grant_job"
  ADD CONSTRAINT "coupon_admin_grant_job_operation_id_nonblank_chk"
  CHECK (length(trim("operation_id")) > 0);
--> statement-breakpoint
ALTER TABLE "coupon_admin_grant_job"
  ADD CONSTRAINT "coupon_admin_grant_job_operation_hash_nonblank_chk"
  CHECK (length(trim("operation_hash")) > 0);
--> statement-breakpoint
ALTER TABLE "coupon_admin_grant_job"
  ADD CONSTRAINT "coupon_admin_grant_job_payload_hash_nonblank_chk"
  CHECK (length(trim("payload_hash")) > 0);
--> statement-breakpoint
ALTER TABLE "coupon_admin_grant_job"
  ADD CONSTRAINT "coupon_admin_grant_job_per_user_quantity_positive_chk"
  CHECK ("per_user_quantity" > 0);
--> statement-breakpoint
ALTER TABLE "coupon_admin_grant_job"
  ADD CONSTRAINT "coupon_admin_grant_job_selected_user_count_positive_chk"
  CHECK ("selected_user_count" > 0);
--> statement-breakpoint
ALTER TABLE "coupon_admin_grant_job"
  ADD CONSTRAINT "coupon_admin_grant_job_requested_grant_count_positive_chk"
  CHECK ("requested_grant_count" > 0);
--> statement-breakpoint
CREATE TABLE "coupon_admin_grant_item" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "item_id" varchar(36) NOT NULL,
  "coupon_admin_grant_job_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "status" smallint NOT NULL,
  "grant_count" integer NOT NULL,
  "created_count" integer DEFAULT 0 NOT NULL,
  "current_attempt_no" integer,
  "failure_count" integer DEFAULT 0 NOT NULL,
  "last_error" jsonb,
  "last_failed_at" timestamp(6) with time zone,
  "next_retry_at" timestamp(6) with time zone,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coupon_admin_grant_item"
  ADD CONSTRAINT "coupon_admin_grant_item_item_id_key"
  UNIQUE ("item_id");
--> statement-breakpoint
ALTER TABLE "coupon_admin_grant_item"
  ADD CONSTRAINT "coupon_admin_grant_item_job_user_key"
  UNIQUE ("coupon_admin_grant_job_id", "user_id");
--> statement-breakpoint
CREATE INDEX "coupon_admin_grant_item_job_status_updated_id_idx"
  ON "coupon_admin_grant_item" (
    "coupon_admin_grant_job_id",
    "status",
    "updated_at",
    "id"
  );
--> statement-breakpoint
CREATE INDEX "coupon_admin_grant_item_user_created_at_idx"
  ON "coupon_admin_grant_item" ("user_id", "created_at" DESC);
--> statement-breakpoint
ALTER TABLE "coupon_admin_grant_item"
  ADD CONSTRAINT "coupon_admin_grant_item_status_valid_chk"
  CHECK ("status" in (1, 2, 3, 4, 5, 6));
--> statement-breakpoint
ALTER TABLE "coupon_admin_grant_item"
  ADD CONSTRAINT "coupon_admin_grant_item_grant_count_positive_chk"
  CHECK ("grant_count" > 0);
--> statement-breakpoint
ALTER TABLE "coupon_admin_grant_item"
  ADD CONSTRAINT "coupon_admin_grant_item_created_count_non_negative_chk"
  CHECK ("created_count" >= 0);
--> statement-breakpoint
ALTER TABLE "coupon_admin_grant_item"
  ADD CONSTRAINT "coupon_admin_grant_item_failure_count_non_negative_chk"
  CHECK ("failure_count" >= 0);
--> statement-breakpoint
ALTER TABLE "coupon_admin_grant_item"
  ADD CONSTRAINT "coupon_admin_grant_item_current_attempt_no_positive_chk"
  CHECK ("current_attempt_no" is null or "current_attempt_no" > 0);
