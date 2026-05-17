-- 破坏性更新：旧漫画压缩包预解析表、旧三方导入/同步后台任务历史允许直接清空。
-- 除旧 archive 表和 background_task/background_task_conflict_key 两个后台任务表面外，
-- 本仓库没有其他旧三方解析 runtime 专属数据库表需要迁移。
DELETE FROM "background_task_conflict_key" AS "conflict_key"
USING "background_task" AS "task"
WHERE "conflict_key"."task_id" = "task"."task_id"
  AND "task"."task_type" IN (
    'content.third-party-comic-import',
    'content.third-party-comic-sync'
  );

DELETE FROM "background_task"
WHERE "task_type" IN (
  'content.third-party-comic-import',
  'content.third-party-comic-sync'
);

CREATE TABLE "workflow_job" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "job_id" varchar(36) NOT NULL,
  "workflow_type" varchar(120) NOT NULL,
  "display_name" varchar(180) NOT NULL,
  "operator_type" smallint NOT NULL,
  "operator_user_id" integer,
  "status" smallint NOT NULL,
  "progress_percent" integer DEFAULT 0 NOT NULL,
  "progress_message" varchar(300),
  "current_attempt_fk" bigint,
  "selected_item_count" integer DEFAULT 0 NOT NULL,
  "success_item_count" integer DEFAULT 0 NOT NULL,
  "failed_item_count" integer DEFAULT 0 NOT NULL,
  "skipped_item_count" integer DEFAULT 0 NOT NULL,
  "cancel_requested_at" timestamp(6) with time zone,
  "started_at" timestamp(6) with time zone,
  "finished_at" timestamp(6) with time zone,
  "expires_at" timestamp(6) with time zone,
  "summary" jsonb,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workflow_job_job_id_key" UNIQUE ("job_id"),
  CONSTRAINT "workflow_job_workflow_type_nonblank_chk" CHECK (length(trim("workflow_type")) > 0),
  CONSTRAINT "workflow_job_display_name_nonblank_chk" CHECK (length(trim("display_name")) > 0),
  CONSTRAINT "workflow_job_operator_type_valid_chk" CHECK ("operator_type" in (1, 2)),
  CONSTRAINT "workflow_job_operator_user_id_scope_chk" CHECK (("operator_type" = 1 and "operator_user_id" is not null) or ("operator_type" = 2 and "operator_user_id" is null)),
  CONSTRAINT "workflow_job_status_valid_chk" CHECK ("status" in (1, 2, 3, 4, 5, 6, 7, 8)),
  CONSTRAINT "workflow_job_progress_percent_range_chk" CHECK ("progress_percent" between 0 and 100),
  CONSTRAINT "workflow_job_selected_item_count_non_negative_chk" CHECK ("selected_item_count" >= 0),
  CONSTRAINT "workflow_job_success_item_count_non_negative_chk" CHECK ("success_item_count" >= 0),
  CONSTRAINT "workflow_job_failed_item_count_non_negative_chk" CHECK ("failed_item_count" >= 0),
  CONSTRAINT "workflow_job_skipped_item_count_non_negative_chk" CHECK ("skipped_item_count" >= 0)
);

CREATE INDEX "workflow_job_workflow_type_status_updated_at_id_idx" ON "workflow_job" ("workflow_type", "status", "updated_at" DESC, "id" DESC);
CREATE INDEX "workflow_job_status_updated_at_id_idx" ON "workflow_job" ("status", "updated_at" DESC, "id" DESC);
CREATE INDEX "workflow_job_operator_updated_at_id_idx" ON "workflow_job" ("operator_type", "operator_user_id", "updated_at" DESC, "id" DESC);
CREATE INDEX "workflow_job_status_created_at_id_idx" ON "workflow_job" ("status", "created_at", "id");

CREATE TABLE "workflow_attempt" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "attempt_id" varchar(36) NOT NULL,
  "workflow_job_id" bigint NOT NULL,
  "attempt_no" integer NOT NULL,
  "trigger_type" smallint NOT NULL,
  "status" smallint NOT NULL,
  "selected_item_count" integer DEFAULT 0 NOT NULL,
  "success_item_count" integer DEFAULT 0 NOT NULL,
  "failed_item_count" integer DEFAULT 0 NOT NULL,
  "skipped_item_count" integer DEFAULT 0 NOT NULL,
  "claimed_by" varchar(120),
  "claim_expires_at" timestamp(6) with time zone,
  "heartbeat_at" timestamp(6) with time zone,
  "error_code" varchar(120),
  "error_message" varchar(500),
  "started_at" timestamp(6) with time zone,
  "finished_at" timestamp(6) with time zone,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workflow_attempt_attempt_id_key" UNIQUE ("attempt_id"),
  CONSTRAINT "workflow_attempt_job_attempt_no_key" UNIQUE ("workflow_job_id", "attempt_no"),
  CONSTRAINT "workflow_attempt_attempt_no_positive_chk" CHECK ("attempt_no" > 0),
  CONSTRAINT "workflow_attempt_trigger_type_valid_chk" CHECK ("trigger_type" in (1, 2, 3)),
  CONSTRAINT "workflow_attempt_status_valid_chk" CHECK ("status" in (1, 2, 3, 4, 5, 6)),
  CONSTRAINT "workflow_attempt_selected_item_count_non_negative_chk" CHECK ("selected_item_count" >= 0),
  CONSTRAINT "workflow_attempt_success_item_count_non_negative_chk" CHECK ("success_item_count" >= 0),
  CONSTRAINT "workflow_attempt_failed_item_count_non_negative_chk" CHECK ("failed_item_count" >= 0),
  CONSTRAINT "workflow_attempt_skipped_item_count_non_negative_chk" CHECK ("skipped_item_count" >= 0)
);

CREATE INDEX "workflow_attempt_job_attempt_no_idx" ON "workflow_attempt" ("workflow_job_id", "attempt_no");
CREATE INDEX "workflow_attempt_status_created_at_id_idx" ON "workflow_attempt" ("status", "created_at", "id");
CREATE INDEX "workflow_attempt_status_claim_expires_at_idx" ON "workflow_attempt" ("status", "claim_expires_at");

CREATE TABLE "workflow_event" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "workflow_job_id" bigint NOT NULL,
  "workflow_attempt_id" bigint,
  "event_type" smallint NOT NULL,
  "message" varchar(500) NOT NULL,
  "detail" jsonb,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workflow_event_type_valid_chk" CHECK ("event_type" in (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)),
  CONSTRAINT "workflow_event_message_nonblank_chk" CHECK (length(trim("message")) > 0)
);

CREATE INDEX "workflow_event_job_created_at_id_idx" ON "workflow_event" ("workflow_job_id", "created_at", "id");
CREATE INDEX "workflow_event_attempt_created_at_id_idx" ON "workflow_event" ("workflow_attempt_id", "created_at", "id");

CREATE TABLE "workflow_conflict_key" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "workflow_job_id" bigint NOT NULL,
  "workflow_type" varchar(120) NOT NULL,
  "conflict_key" varchar(300) NOT NULL,
  "released_at" timestamp(6) with time zone,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "workflow_conflict_key_workflow_type_nonblank_chk" CHECK (length(trim("workflow_type")) > 0),
  CONSTRAINT "workflow_conflict_key_nonblank_chk" CHECK (length(trim("conflict_key")) > 0)
);

CREATE UNIQUE INDEX "workflow_conflict_key_workflow_type_active_key_uidx" ON "workflow_conflict_key" ("workflow_type", "conflict_key") WHERE "released_at" is null;
CREATE INDEX "workflow_conflict_key_job_id_idx" ON "workflow_conflict_key" ("workflow_job_id");
CREATE INDEX "workflow_conflict_key_workflow_type_key_idx" ON "workflow_conflict_key" ("workflow_type", "conflict_key");
CREATE INDEX "workflow_conflict_key_released_created_at_idx" ON "workflow_conflict_key" ("released_at", "created_at");

CREATE TABLE "content_import_job" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "workflow_job_id" bigint NOT NULL,
  "content_type" smallint NOT NULL,
  "source_type" smallint NOT NULL,
  "work_id" integer,
  "platform" varchar(30),
  "provider_comic_id" varchar(100),
  "provider_path_word" varchar(100),
  "provider_group_path_word" varchar(100),
  "archive_name" varchar(255),
  "archive_path" varchar(1000),
  "extract_path" varchar(1000),
  "preview_mode" smallint,
  "source_snapshot" jsonb,
  "publish_boundary_status" smallint DEFAULT 1 NOT NULL,
  "selected_item_count" integer DEFAULT 0 NOT NULL,
  "success_item_count" integer DEFAULT 0 NOT NULL,
  "failed_item_count" integer DEFAULT 0 NOT NULL,
  "skipped_item_count" integer DEFAULT 0 NOT NULL,
  "image_total" integer DEFAULT 0 NOT NULL,
  "image_success_count" integer DEFAULT 0 NOT NULL,
  "image_failed_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "content_import_job_workflow_job_id_key" UNIQUE ("workflow_job_id"),
  CONSTRAINT "content_import_job_content_type_valid_chk" CHECK ("content_type" in (1)),
  CONSTRAINT "content_import_job_source_type_valid_chk" CHECK ("source_type" in (1, 2, 3)),
  CONSTRAINT "content_import_job_preview_mode_valid_chk" CHECK ("preview_mode" is null or "preview_mode" in (1, 2)),
  CONSTRAINT "content_import_job_publish_boundary_status_valid_chk" CHECK ("publish_boundary_status" in (1, 2)),
  CONSTRAINT "content_import_job_selected_item_count_non_negative_chk" CHECK ("selected_item_count" >= 0),
  CONSTRAINT "content_import_job_success_item_count_non_negative_chk" CHECK ("success_item_count" >= 0),
  CONSTRAINT "content_import_job_failed_item_count_non_negative_chk" CHECK ("failed_item_count" >= 0),
  CONSTRAINT "content_import_job_skipped_item_count_non_negative_chk" CHECK ("skipped_item_count" >= 0),
  CONSTRAINT "content_import_job_image_total_non_negative_chk" CHECK ("image_total" >= 0),
  CONSTRAINT "content_import_job_image_success_count_non_negative_chk" CHECK ("image_success_count" >= 0),
  CONSTRAINT "content_import_job_image_failed_count_non_negative_chk" CHECK ("image_failed_count" >= 0)
);

CREATE INDEX "content_import_job_source_type_work_id_idx" ON "content_import_job" ("source_type", "work_id");
CREATE INDEX "content_import_job_platform_source_idx" ON "content_import_job" ("platform", "provider_comic_id", "provider_group_path_word");

CREATE TABLE "content_import_preview_item" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "preview_item_id" varchar(36) NOT NULL,
  "content_import_job_id" bigint NOT NULL,
  "item_type" smallint NOT NULL,
  "source_path" varchar(1000),
  "provider_chapter_id" varchar(100),
  "target_chapter_id" integer,
  "title" varchar(200) NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "image_total" integer DEFAULT 0 NOT NULL,
  "status" smallint NOT NULL,
  "ignore_reason" varchar(300),
  "warning_message" varchar(500),
  "metadata" jsonb,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "content_import_preview_item_preview_item_id_key" UNIQUE ("preview_item_id"),
  CONSTRAINT "content_import_preview_item_item_type_valid_chk" CHECK ("item_type" in (1)),
  CONSTRAINT "content_import_preview_item_status_valid_chk" CHECK ("status" in (1, 2, 3)),
  CONSTRAINT "content_import_preview_item_title_nonblank_chk" CHECK (length(trim("title")) > 0),
  CONSTRAINT "content_import_preview_item_image_total_non_negative_chk" CHECK ("image_total" >= 0)
);

CREATE INDEX "content_import_preview_item_job_status_sort_idx" ON "content_import_preview_item" ("content_import_job_id", "status", "sort_order", "id");

CREATE TABLE "content_import_item" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "item_id" varchar(36) NOT NULL,
  "content_import_job_id" bigint NOT NULL,
  "item_type" smallint NOT NULL,
  "provider_chapter_id" varchar(100),
  "target_chapter_id" integer,
  "local_chapter_id" integer,
  "title" varchar(200) NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "status" smallint NOT NULL,
  "stage" smallint NOT NULL,
  "failure_count" integer DEFAULT 0 NOT NULL,
  "last_error_code" varchar(120),
  "last_error_message" varchar(500),
  "last_failed_at" timestamp(6) with time zone,
  "image_total" integer DEFAULT 0 NOT NULL,
  "image_success_count" integer DEFAULT 0 NOT NULL,
  "current_attempt_no" integer,
  "metadata" jsonb,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "content_import_item_item_id_key" UNIQUE ("item_id"),
  CONSTRAINT "content_import_item_item_type_valid_chk" CHECK ("item_type" in (1)),
  CONSTRAINT "content_import_item_status_valid_chk" CHECK ("status" in (1, 2, 3, 4, 5, 6)),
  CONSTRAINT "content_import_item_stage_valid_chk" CHECK ("stage" in (1, 2, 3, 4, 5, 6, 7, 8)),
  CONSTRAINT "content_import_item_title_nonblank_chk" CHECK (length(trim("title")) > 0),
  CONSTRAINT "content_import_item_failure_count_non_negative_chk" CHECK ("failure_count" >= 0),
  CONSTRAINT "content_import_item_image_total_non_negative_chk" CHECK ("image_total" >= 0),
  CONSTRAINT "content_import_item_image_success_count_non_negative_chk" CHECK ("image_success_count" >= 0),
  CONSTRAINT "content_import_item_current_attempt_no_positive_chk" CHECK ("current_attempt_no" is null or "current_attempt_no" > 0)
);

CREATE INDEX "content_import_item_job_status_sort_idx" ON "content_import_item" ("content_import_job_id", "status", "sort_order", "id");
CREATE INDEX "content_import_item_job_provider_chapter_idx" ON "content_import_item" ("content_import_job_id", "provider_chapter_id");
CREATE INDEX "content_import_item_job_local_chapter_idx" ON "content_import_item" ("content_import_job_id", "local_chapter_id");

CREATE TABLE "content_import_item_attempt" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "item_attempt_id" varchar(36) NOT NULL,
  "workflow_attempt_id" bigint NOT NULL,
  "content_import_item_id" bigint NOT NULL,
  "attempt_no" integer NOT NULL,
  "status" smallint NOT NULL,
  "stage" smallint NOT NULL,
  "image_total" integer DEFAULT 0 NOT NULL,
  "image_success_count" integer DEFAULT 0 NOT NULL,
  "error_code" varchar(120),
  "error_message" varchar(500),
  "started_at" timestamp(6) with time zone,
  "finished_at" timestamp(6) with time zone,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "content_import_item_attempt_item_attempt_id_key" UNIQUE ("item_attempt_id"),
  CONSTRAINT "content_import_item_attempt_item_attempt_no_key" UNIQUE ("content_import_item_id", "attempt_no"),
  CONSTRAINT "content_import_item_attempt_attempt_no_positive_chk" CHECK ("attempt_no" > 0),
  CONSTRAINT "content_import_item_attempt_status_valid_chk" CHECK ("status" in (1, 2, 3, 4, 5)),
  CONSTRAINT "content_import_item_attempt_stage_valid_chk" CHECK ("stage" in (1, 2, 3, 4, 5, 6, 7, 8)),
  CONSTRAINT "content_import_item_attempt_image_total_non_negative_chk" CHECK ("image_total" >= 0),
  CONSTRAINT "content_import_item_attempt_image_success_count_non_negative_chk" CHECK ("image_success_count" >= 0)
);

CREATE INDEX "content_import_item_attempt_workflow_attempt_status_idx" ON "content_import_item_attempt" ("workflow_attempt_id", "status");
CREATE INDEX "content_import_item_attempt_item_id_idx" ON "content_import_item_attempt" ("content_import_item_id");

CREATE TABLE "content_import_residue" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "residue_id" varchar(36) NOT NULL,
  "workflow_job_id" bigint NOT NULL,
  "workflow_attempt_id" bigint,
  "content_import_item_id" bigint,
  "content_import_item_attempt_id" bigint,
  "residue_type" smallint NOT NULL,
  "provider" varchar(60),
  "file_path" varchar(1000),
  "local_path" varchar(1000),
  "metadata" jsonb,
  "cleanup_status" smallint NOT NULL,
  "cleanup_error" varchar(500),
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "cleaned_at" timestamp(6) with time zone,
  CONSTRAINT "content_import_residue_residue_id_key" UNIQUE ("residue_id"),
  CONSTRAINT "content_import_residue_type_valid_chk" CHECK ("residue_type" in (1, 2, 3, 4, 5)),
  CONSTRAINT "content_import_residue_cleanup_status_valid_chk" CHECK ("cleanup_status" in (1, 2, 3, 4))
);

CREATE INDEX "content_import_residue_job_cleanup_status_idx" ON "content_import_residue" ("workflow_job_id", "cleanup_status");
CREATE INDEX "content_import_residue_attempt_idx" ON "content_import_residue" ("workflow_attempt_id");
CREATE INDEX "content_import_residue_item_idx" ON "content_import_residue" ("content_import_item_id");
CREATE INDEX "content_import_residue_item_attempt_idx" ON "content_import_residue" ("content_import_item_attempt_id");

CREATE TABLE "content_import_event_link" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "workflow_event_id" bigint NOT NULL,
  "content_import_job_id" bigint NOT NULL,
  "content_import_item_id" bigint,
  "content_import_item_attempt_id" bigint,
  CONSTRAINT "content_import_event_link_workflow_event_id_key" UNIQUE ("workflow_event_id")
);

CREATE INDEX "content_import_event_link_job_idx" ON "content_import_event_link" ("content_import_job_id");
CREATE INDEX "content_import_event_link_item_idx" ON "content_import_event_link" ("content_import_item_id");
CREATE INDEX "content_import_event_link_item_attempt_idx" ON "content_import_event_link" ("content_import_item_attempt_id");

DROP TABLE IF EXISTS "work_comic_archive_import_preview_session";
DROP TABLE IF EXISTS "work_comic_archive_import_task";
