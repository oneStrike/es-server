CREATE TABLE "task_definition" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "code" varchar(50) NOT NULL,
  "title" varchar(200) NOT NULL,
  "description" varchar(1000),
  "cover" varchar(255),
  "scene_type" smallint NOT NULL,
  "status" smallint NOT NULL,
  "priority" smallint DEFAULT 0 NOT NULL,
  "claim_mode" smallint NOT NULL,
  "completion_policy" smallint DEFAULT 1 NOT NULL,
  "repeat_type" smallint DEFAULT 0 NOT NULL,
  "repeat_timezone" varchar(64),
  "start_at" timestamp (6) with time zone,
  "end_at" timestamp (6) with time zone,
  "audience_segment_id" varchar(80),
  "reward_items" jsonb,
  "created_by_id" integer,
  "updated_by_id" integer,
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp (6) with time zone NOT NULL,
  "deleted_at" timestamp (6) with time zone,
  CONSTRAINT "task_definition_code_key" UNIQUE("code"),
  CONSTRAINT "task_definition_scene_type_valid_chk" CHECK ("scene_type" in (1, 2, 4)),
  CONSTRAINT "task_definition_status_valid_chk" CHECK ("status" in (0, 1, 2, 3)),
  CONSTRAINT "task_definition_priority_non_negative_chk" CHECK ("priority" >= 0),
  CONSTRAINT "task_definition_claim_mode_valid_chk" CHECK ("claim_mode" in (1, 2)),
  CONSTRAINT "task_definition_completion_policy_valid_chk" CHECK ("completion_policy" in (1)),
  CONSTRAINT "task_definition_repeat_type_valid_chk" CHECK ("repeat_type" in (0, 1, 2, 3)),
  CONSTRAINT "task_definition_code_not_blank_chk" CHECK (btrim("code") <> ''),
  CONSTRAINT "task_definition_title_not_blank_chk" CHECK (btrim("title") <> ''),
  CONSTRAINT "task_definition_repeat_timezone_not_blank_chk" CHECK ("repeat_timezone" is null or btrim("repeat_timezone") <> ''),
  CONSTRAINT "task_definition_audience_segment_id_not_blank_chk" CHECK ("audience_segment_id" is null or btrim("audience_segment_id") <> ''),
  CONSTRAINT "task_definition_publish_window_valid_chk" CHECK ("start_at" is null or "end_at" is null or "start_at" <= "end_at")
);

CREATE TABLE "task_step" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "task_id" integer NOT NULL,
  "step_key" varchar(50) NOT NULL,
  "title" varchar(200) NOT NULL,
  "description" varchar(1000),
  "step_no" smallint NOT NULL,
  "trigger_mode" smallint NOT NULL,
  "progress_mode" smallint NOT NULL,
  "event_code" integer,
  "target_value" integer DEFAULT 1 NOT NULL,
  "template_key" varchar(80),
  "filter_payload" jsonb,
  "unique_dimension_key" varchar(80),
  "dedupe_scope" smallint,
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp (6) with time zone NOT NULL,
  CONSTRAINT "task_step_task_id_step_key_key" UNIQUE("task_id", "step_key"),
  CONSTRAINT "task_step_task_id_step_no_key" UNIQUE("task_id", "step_no"),
  CONSTRAINT "task_step_step_no_positive_chk" CHECK ("step_no" > 0),
  CONSTRAINT "task_step_trigger_mode_valid_chk" CHECK ("trigger_mode" in (1, 2)),
  CONSTRAINT "task_step_progress_mode_valid_chk" CHECK ("progress_mode" in (1, 2, 3)),
  CONSTRAINT "task_step_target_value_positive_chk" CHECK ("target_value" > 0),
  CONSTRAINT "task_step_event_code_positive_chk" CHECK ("event_code" is null or "event_code" > 0),
  CONSTRAINT "task_step_step_key_not_blank_chk" CHECK (btrim("step_key") <> ''),
  CONSTRAINT "task_step_title_not_blank_chk" CHECK (btrim("title") <> ''),
  CONSTRAINT "task_step_template_key_not_blank_chk" CHECK ("template_key" is null or btrim("template_key") <> ''),
  CONSTRAINT "task_step_unique_dimension_key_not_blank_chk" CHECK ("unique_dimension_key" is null or btrim("unique_dimension_key") <> ''),
  CONSTRAINT "task_step_dedupe_scope_valid_chk" CHECK ("dedupe_scope" is null or "dedupe_scope" in (1, 2))
);

CREATE TABLE "task_instance" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "task_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "cycle_key" varchar(64) NOT NULL,
  "status" smallint NOT NULL,
  "reward_applicable" smallint DEFAULT 0 NOT NULL,
  "reward_settlement_id" integer,
  "snapshot_payload" jsonb,
  "context" jsonb,
  "version" integer DEFAULT 0 NOT NULL,
  "claimed_at" timestamp (6) with time zone,
  "completed_at" timestamp (6) with time zone,
  "expired_at" timestamp (6) with time zone,
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp (6) with time zone NOT NULL,
  "deleted_at" timestamp (6) with time zone,
  CONSTRAINT "task_instance_task_id_user_id_cycle_key_key" UNIQUE("task_id", "user_id", "cycle_key"),
  CONSTRAINT "task_instance_cycle_key_not_blank_chk" CHECK (btrim("cycle_key") <> ''),
  CONSTRAINT "task_instance_status_valid_chk" CHECK ("status" in (0, 1, 2, 3)),
  CONSTRAINT "task_instance_reward_applicable_valid_chk" CHECK ("reward_applicable" in (0, 1)),
  CONSTRAINT "task_instance_version_non_negative_chk" CHECK ("version" >= 0),
  CONSTRAINT "task_instance_reward_settlement_id_positive_chk" CHECK ("reward_settlement_id" is null or "reward_settlement_id" > 0)
);

CREATE TABLE "task_instance_step" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "instance_id" integer NOT NULL,
  "step_id" integer NOT NULL,
  "status" smallint NOT NULL,
  "current_value" integer DEFAULT 0 NOT NULL,
  "target_value" integer DEFAULT 1 NOT NULL,
  "completed_at" timestamp (6) with time zone,
  "context" jsonb,
  "version" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp (6) with time zone NOT NULL,
  CONSTRAINT "task_instance_step_instance_id_step_id_key" UNIQUE("instance_id", "step_id"),
  CONSTRAINT "task_instance_step_status_valid_chk" CHECK ("status" in (0, 1, 2, 3)),
  CONSTRAINT "task_instance_step_current_value_non_negative_chk" CHECK ("current_value" >= 0),
  CONSTRAINT "task_instance_step_target_value_positive_chk" CHECK ("target_value" > 0),
  CONSTRAINT "task_instance_step_version_non_negative_chk" CHECK ("version" >= 0)
);

CREATE TABLE "task_step_unique_fact" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "task_id" integer NOT NULL,
  "step_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "cycle_key" varchar(64),
  "dedupe_scope" smallint NOT NULL,
  "scope_key" varchar(64) NOT NULL,
  "dimension_key" varchar(80) NOT NULL,
  "dimension_value" varchar(255) NOT NULL,
  "dimension_hash" varchar(120) NOT NULL,
  "first_event_code" integer,
  "first_event_biz_key" varchar(180),
  "first_target_type" varchar(80),
  "first_target_id" integer,
  "first_occurred_at" timestamp (6) with time zone NOT NULL,
  "first_context" jsonb,
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "task_step_unique_fact_step_id_user_id_scope_key_dimension_hash_key" UNIQUE("step_id", "user_id", "scope_key", "dimension_hash"),
  CONSTRAINT "task_step_unique_fact_dedupe_scope_valid_chk" CHECK ("dedupe_scope" in (1, 2)),
  CONSTRAINT "task_step_unique_fact_scope_key_not_blank_chk" CHECK (btrim("scope_key") <> ''),
  CONSTRAINT "task_step_unique_fact_dimension_key_not_blank_chk" CHECK (btrim("dimension_key") <> ''),
  CONSTRAINT "task_step_unique_fact_dimension_value_not_blank_chk" CHECK (btrim("dimension_value") <> ''),
  CONSTRAINT "task_step_unique_fact_dimension_hash_not_blank_chk" CHECK (btrim("dimension_hash") <> ''),
  CONSTRAINT "task_step_unique_fact_cycle_key_not_blank_chk" CHECK ("cycle_key" is null or btrim("cycle_key") <> ''),
  CONSTRAINT "task_step_unique_fact_event_code_positive_chk" CHECK ("first_event_code" is null or "first_event_code" > 0),
  CONSTRAINT "task_step_unique_fact_event_biz_key_not_blank_chk" CHECK ("first_event_biz_key" is null or btrim("first_event_biz_key") <> ''),
  CONSTRAINT "task_step_unique_fact_target_type_not_blank_chk" CHECK ("first_target_type" is null or btrim("first_target_type") <> ''),
  CONSTRAINT "task_step_unique_fact_target_id_positive_chk" CHECK ("first_target_id" is null or "first_target_id" > 0)
);

CREATE TABLE "task_event_log" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "task_id" integer NOT NULL,
  "step_id" integer,
  "instance_id" integer,
  "instance_step_id" integer,
  "user_id" integer NOT NULL,
  "event_code" integer,
  "event_biz_key" varchar(180),
  "action_type" smallint NOT NULL,
  "progress_source" smallint DEFAULT 1 NOT NULL,
  "accepted" boolean DEFAULT true NOT NULL,
  "reject_reason" varchar(120),
  "delta" integer DEFAULT 0 NOT NULL,
  "before_value" integer DEFAULT 0 NOT NULL,
  "after_value" integer DEFAULT 0 NOT NULL,
  "target_type" varchar(80),
  "target_id" integer,
  "dimension_key" varchar(80),
  "dimension_value" varchar(255),
  "occurred_at" timestamp (6) with time zone,
  "context" jsonb,
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "task_event_log_action_type_valid_chk" CHECK ("action_type" in (1, 2, 3, 4, 5)),
  CONSTRAINT "task_event_log_progress_source_valid_chk" CHECK ("progress_source" in (1, 2, 3)),
  CONSTRAINT "task_event_log_delta_non_negative_chk" CHECK ("delta" >= 0),
  CONSTRAINT "task_event_log_before_value_non_negative_chk" CHECK ("before_value" >= 0),
  CONSTRAINT "task_event_log_after_value_non_negative_chk" CHECK ("after_value" >= 0),
  CONSTRAINT "task_event_log_event_code_positive_chk" CHECK ("event_code" is null or "event_code" > 0),
  CONSTRAINT "task_event_log_event_biz_key_not_blank_chk" CHECK ("event_biz_key" is null or btrim("event_biz_key") <> ''),
  CONSTRAINT "task_event_log_reject_reason_not_blank_chk" CHECK ("reject_reason" is null or btrim("reject_reason") <> ''),
  CONSTRAINT "task_event_log_target_type_not_blank_chk" CHECK ("target_type" is null or btrim("target_type") <> ''),
  CONSTRAINT "task_event_log_target_id_positive_chk" CHECK ("target_id" is null or "target_id" > 0),
  CONSTRAINT "task_event_log_dimension_key_not_blank_chk" CHECK ("dimension_key" is null or btrim("dimension_key") <> ''),
  CONSTRAINT "task_event_log_dimension_value_not_blank_chk" CHECK ("dimension_value" is null or btrim("dimension_value") <> '')
);

CREATE INDEX "task_definition_status_idx" ON "task_definition" ("status");
CREATE INDEX "task_definition_scene_type_idx" ON "task_definition" ("scene_type");
CREATE INDEX "task_definition_priority_idx" ON "task_definition" ("priority");
CREATE INDEX "task_definition_start_at_idx" ON "task_definition" ("start_at");
CREATE INDEX "task_definition_end_at_idx" ON "task_definition" ("end_at");
CREATE INDEX "task_definition_deleted_at_idx" ON "task_definition" ("deleted_at");

CREATE INDEX "task_step_task_id_idx" ON "task_step" ("task_id");
CREATE INDEX "task_step_template_key_idx" ON "task_step" ("template_key");
CREATE INDEX "task_step_event_code_idx" ON "task_step" ("event_code");

CREATE INDEX "task_instance_user_id_status_idx" ON "task_instance" ("user_id", "status");
CREATE INDEX "task_instance_task_id_idx" ON "task_instance" ("task_id");
CREATE INDEX "task_instance_completed_at_idx" ON "task_instance" ("completed_at");
CREATE INDEX "task_instance_expired_at_idx" ON "task_instance" ("expired_at");
CREATE INDEX "task_instance_reward_settlement_id_idx" ON "task_instance" ("reward_settlement_id");
CREATE INDEX "task_instance_deleted_at_idx" ON "task_instance" ("deleted_at");

CREATE INDEX "task_instance_step_instance_id_idx" ON "task_instance_step" ("instance_id");
CREATE INDEX "task_instance_step_step_id_idx" ON "task_instance_step" ("step_id");
CREATE INDEX "task_instance_step_completed_at_idx" ON "task_instance_step" ("completed_at");

CREATE INDEX "task_step_unique_fact_user_id_step_id_idx" ON "task_step_unique_fact" ("user_id", "step_id");
CREATE INDEX "task_step_unique_fact_task_id_idx" ON "task_step_unique_fact" ("task_id");
CREATE INDEX "task_step_unique_fact_first_event_biz_key_idx" ON "task_step_unique_fact" ("first_event_biz_key");

CREATE INDEX "task_event_log_task_id_created_at_idx" ON "task_event_log" ("task_id", "created_at");
CREATE INDEX "task_event_log_instance_id_idx" ON "task_event_log" ("instance_id");
CREATE INDEX "task_event_log_instance_step_id_idx" ON "task_event_log" ("instance_step_id");
CREATE INDEX "task_event_log_user_id_created_at_idx" ON "task_event_log" ("user_id", "created_at");
CREATE INDEX "task_event_log_event_code_created_at_idx" ON "task_event_log" ("event_code", "created_at");
