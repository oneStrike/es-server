DROP TABLE IF EXISTS "check_in_streak_reward_grant";
DROP TABLE IF EXISTS "check_in_streak_progress";
DROP TABLE IF EXISTS "check_in_streak_round_config";

DROP TABLE IF EXISTS "check_in_streak_grant_reward_item";
DROP TABLE IF EXISTS "check_in_streak_grant";
DROP TABLE IF EXISTS "check_in_activity_streak_progress";
DROP TABLE IF EXISTS "check_in_activity_streak_rule_reward_item";
DROP TABLE IF EXISTS "check_in_activity_streak_rule";
DROP TABLE IF EXISTS "check_in_activity_streak";
DROP TABLE IF EXISTS "check_in_daily_streak_progress";
DROP TABLE IF EXISTS "check_in_daily_streak_rule_reward_item";
DROP TABLE IF EXISTS "check_in_daily_streak_rule";
DROP TABLE IF EXISTS "check_in_daily_streak_config";

CREATE TABLE "check_in_daily_streak_config" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "version" integer NOT NULL DEFAULT 1,
  "status" smallint NOT NULL DEFAULT 0,
  "publish_strategy" smallint NOT NULL,
  "effective_from" timestamp(6) with time zone NOT NULL,
  "effective_to" timestamp(6) with time zone,
  "updated_by_id" integer,
  "created_at" timestamp(6) with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp(6) with time zone NOT NULL
);

ALTER TABLE "check_in_daily_streak_config"
  ADD CONSTRAINT "check_in_daily_streak_config_version_key" UNIQUE ("version"),
  ADD CONSTRAINT "check_in_daily_streak_config_version_positive_chk" CHECK ("version" > 0),
  ADD CONSTRAINT "check_in_daily_streak_config_status_valid_chk" CHECK ("status" in (0, 1, 2, 3, 4)),
  ADD CONSTRAINT "check_in_daily_streak_config_publish_strategy_valid_chk" CHECK ("publish_strategy" in (1, 2, 3)),
  ADD CONSTRAINT "check_in_daily_streak_config_effective_window_valid_chk" CHECK ("effective_to" is null or "effective_to" > "effective_from");

CREATE INDEX "check_in_daily_streak_config_status_idx" ON "check_in_daily_streak_config" ("status");
CREATE INDEX "check_in_daily_streak_config_effective_from_idx" ON "check_in_daily_streak_config" ("effective_from");
CREATE INDEX "check_in_daily_streak_config_effective_to_idx" ON "check_in_daily_streak_config" ("effective_to");

CREATE TABLE "check_in_daily_streak_rule" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "config_id" integer NOT NULL,
  "rule_code" varchar(50) NOT NULL,
  "streak_days" integer NOT NULL,
  "repeatable" boolean NOT NULL DEFAULT false,
  "status" smallint NOT NULL DEFAULT 1,
  "created_at" timestamp(6) with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp(6) with time zone NOT NULL
);

ALTER TABLE "check_in_daily_streak_rule"
  ADD CONSTRAINT "check_in_daily_streak_rule_config_streak_days_key" UNIQUE ("config_id", "streak_days"),
  ADD CONSTRAINT "check_in_daily_streak_rule_config_rule_code_key" UNIQUE ("config_id", "rule_code"),
  ADD CONSTRAINT "check_in_daily_streak_rule_config_id_positive_chk" CHECK ("config_id" > 0),
  ADD CONSTRAINT "check_in_daily_streak_rule_streak_days_positive_chk" CHECK ("streak_days" > 0),
  ADD CONSTRAINT "check_in_daily_streak_rule_status_valid_chk" CHECK ("status" in (0, 1)),
  ADD CONSTRAINT "check_in_daily_streak_rule_rule_code_not_blank_chk" CHECK (btrim("rule_code") <> '');

CREATE INDEX "check_in_daily_streak_rule_config_id_idx" ON "check_in_daily_streak_rule" ("config_id");

CREATE TABLE "check_in_daily_streak_rule_reward_item" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "rule_id" integer NOT NULL,
  "asset_type" smallint NOT NULL,
  "asset_key" varchar(50) NOT NULL DEFAULT '',
  "amount" integer NOT NULL,
  "sort_order" smallint NOT NULL DEFAULT 0
);

ALTER TABLE "check_in_daily_streak_rule_reward_item"
  ADD CONSTRAINT "check_in_daily_streak_rule_reward_item_rule_id_positive_chk" CHECK ("rule_id" > 0),
  ADD CONSTRAINT "check_in_daily_streak_rule_reward_item_asset_type_valid_chk" CHECK ("asset_type" in (1, 2)),
  ADD CONSTRAINT "check_in_daily_streak_rule_reward_item_amount_positive_chk" CHECK ("amount" > 0),
  ADD CONSTRAINT "check_in_daily_streak_rule_reward_item_sort_order_non_negative_chk" CHECK ("sort_order" >= 0);

CREATE INDEX "check_in_daily_streak_rule_reward_item_rule_id_idx" ON "check_in_daily_streak_rule_reward_item" ("rule_id");

CREATE TABLE "check_in_daily_streak_progress" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" integer NOT NULL,
  "current_streak" integer NOT NULL DEFAULT 0,
  "streak_started_at" date,
  "last_signed_date" date,
  "version" integer NOT NULL DEFAULT 0,
  "created_at" timestamp(6) with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp(6) with time zone NOT NULL
);

ALTER TABLE "check_in_daily_streak_progress"
  ADD CONSTRAINT "check_in_daily_streak_progress_user_id_key" UNIQUE ("user_id"),
  ADD CONSTRAINT "check_in_daily_streak_progress_current_streak_non_negative_chk" CHECK ("current_streak" >= 0),
  ADD CONSTRAINT "check_in_daily_streak_progress_version_non_negative_chk" CHECK ("version" >= 0);

CREATE TABLE "check_in_activity_streak" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "activity_key" varchar(80) NOT NULL,
  "title" varchar(120) NOT NULL,
  "status" smallint NOT NULL DEFAULT 0,
  "effective_from" timestamp(6) with time zone NOT NULL,
  "effective_to" timestamp(6) with time zone NOT NULL,
  "updated_by_id" integer,
  "created_at" timestamp(6) with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp(6) with time zone NOT NULL
);

ALTER TABLE "check_in_activity_streak"
  ADD CONSTRAINT "check_in_activity_streak_activity_key_key" UNIQUE ("activity_key"),
  ADD CONSTRAINT "check_in_activity_streak_activity_key_not_blank_chk" CHECK (btrim("activity_key") <> ''),
  ADD CONSTRAINT "check_in_activity_streak_title_not_blank_chk" CHECK (btrim("title") <> ''),
  ADD CONSTRAINT "check_in_activity_streak_status_valid_chk" CHECK ("status" in (0, 1, 2, 3)),
  ADD CONSTRAINT "check_in_activity_streak_effective_window_valid_chk" CHECK ("effective_to" > "effective_from");

CREATE INDEX "check_in_activity_streak_status_idx" ON "check_in_activity_streak" ("status");
CREATE INDEX "check_in_activity_streak_effective_from_idx" ON "check_in_activity_streak" ("effective_from");
CREATE INDEX "check_in_activity_streak_effective_to_idx" ON "check_in_activity_streak" ("effective_to");

CREATE TABLE "check_in_activity_streak_rule" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "activity_id" integer NOT NULL,
  "rule_code" varchar(50) NOT NULL,
  "streak_days" integer NOT NULL,
  "repeatable" boolean NOT NULL DEFAULT false,
  "status" smallint NOT NULL DEFAULT 1,
  "created_at" timestamp(6) with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp(6) with time zone NOT NULL
);

ALTER TABLE "check_in_activity_streak_rule"
  ADD CONSTRAINT "check_in_activity_streak_rule_activity_streak_days_key" UNIQUE ("activity_id", "streak_days"),
  ADD CONSTRAINT "check_in_activity_streak_rule_activity_rule_code_key" UNIQUE ("activity_id", "rule_code"),
  ADD CONSTRAINT "check_in_activity_streak_rule_activity_id_positive_chk" CHECK ("activity_id" > 0),
  ADD CONSTRAINT "check_in_activity_streak_rule_streak_days_positive_chk" CHECK ("streak_days" > 0),
  ADD CONSTRAINT "check_in_activity_streak_rule_status_valid_chk" CHECK ("status" in (0, 1)),
  ADD CONSTRAINT "check_in_activity_streak_rule_rule_code_not_blank_chk" CHECK (btrim("rule_code") <> '');

CREATE INDEX "check_in_activity_streak_rule_activity_id_idx" ON "check_in_activity_streak_rule" ("activity_id");

CREATE TABLE "check_in_activity_streak_rule_reward_item" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "rule_id" integer NOT NULL,
  "asset_type" smallint NOT NULL,
  "asset_key" varchar(50) NOT NULL DEFAULT '',
  "amount" integer NOT NULL,
  "sort_order" smallint NOT NULL DEFAULT 0
);

ALTER TABLE "check_in_activity_streak_rule_reward_item"
  ADD CONSTRAINT "check_in_activity_streak_rule_reward_item_rule_id_positive_chk" CHECK ("rule_id" > 0),
  ADD CONSTRAINT "check_in_activity_streak_rule_reward_item_asset_type_valid_chk" CHECK ("asset_type" in (1, 2)),
  ADD CONSTRAINT "check_in_activity_streak_rule_reward_item_amount_positive_chk" CHECK ("amount" > 0),
  ADD CONSTRAINT "check_in_activity_streak_rule_reward_item_sort_order_non_negative_chk" CHECK ("sort_order" >= 0);

CREATE INDEX "check_in_activity_streak_rule_reward_item_rule_id_idx" ON "check_in_activity_streak_rule_reward_item" ("rule_id");

CREATE TABLE "check_in_activity_streak_progress" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "activity_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "current_streak" integer NOT NULL DEFAULT 0,
  "streak_started_at" date,
  "last_signed_date" date,
  "version" integer NOT NULL DEFAULT 0,
  "created_at" timestamp(6) with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp(6) with time zone NOT NULL
);

ALTER TABLE "check_in_activity_streak_progress"
  ADD CONSTRAINT "check_in_activity_streak_progress_activity_user_key" UNIQUE ("activity_id", "user_id"),
  ADD CONSTRAINT "check_in_activity_streak_progress_activity_id_positive_chk" CHECK ("activity_id" > 0),
  ADD CONSTRAINT "check_in_activity_streak_progress_current_streak_non_negative_chk" CHECK ("current_streak" >= 0),
  ADD CONSTRAINT "check_in_activity_streak_progress_version_non_negative_chk" CHECK ("version" >= 0);

CREATE INDEX "check_in_activity_streak_progress_activity_id_idx" ON "check_in_activity_streak_progress" ("activity_id");
CREATE INDEX "check_in_activity_streak_progress_user_id_idx" ON "check_in_activity_streak_progress" ("user_id");

CREATE TABLE "check_in_streak_grant" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" integer NOT NULL,
  "scope_type" smallint NOT NULL,
  "config_version_id" integer,
  "daily_rule_id" integer,
  "activity_id" integer,
  "activity_rule_id" integer,
  "rule_code" varchar(50) NOT NULL,
  "streak_days" integer NOT NULL,
  "repeatable" boolean NOT NULL DEFAULT false,
  "trigger_sign_date" date NOT NULL,
  "reward_settlement_id" integer,
  "biz_key" varchar(200) NOT NULL,
  "context" jsonb,
  "created_at" timestamp(6) with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp(6) with time zone NOT NULL
);

ALTER TABLE "check_in_streak_grant"
  ADD CONSTRAINT "check_in_streak_grant_user_biz_key_key" UNIQUE ("user_id", "biz_key"),
  ADD CONSTRAINT "check_in_streak_grant_scope_type_valid_chk" CHECK ("scope_type" in (1, 2)),
  ADD CONSTRAINT "check_in_streak_grant_streak_days_positive_chk" CHECK ("streak_days" > 0),
  ADD CONSTRAINT "check_in_streak_grant_config_version_id_positive_chk" CHECK ("config_version_id" is null or "config_version_id" > 0),
  ADD CONSTRAINT "check_in_streak_grant_daily_rule_id_positive_chk" CHECK ("daily_rule_id" is null or "daily_rule_id" > 0),
  ADD CONSTRAINT "check_in_streak_grant_activity_id_positive_chk" CHECK ("activity_id" is null or "activity_id" > 0),
  ADD CONSTRAINT "check_in_streak_grant_activity_rule_id_positive_chk" CHECK ("activity_rule_id" is null or "activity_rule_id" > 0),
  ADD CONSTRAINT "check_in_streak_grant_reward_settlement_id_positive_chk" CHECK ("reward_settlement_id" is null or "reward_settlement_id" > 0),
  ADD CONSTRAINT "check_in_streak_grant_scope_ref_consistent_chk" CHECK ((
    "scope_type" = 1
    and "config_version_id" is not null
    and "daily_rule_id" is not null
    and "activity_id" is null
    and "activity_rule_id" is null
  ) or (
    "scope_type" = 2
    and "config_version_id" is null
    and "daily_rule_id" is null
    and "activity_id" is not null
    and "activity_rule_id" is not null
  ));

CREATE INDEX "check_in_streak_grant_scope_type_idx" ON "check_in_streak_grant" ("scope_type");
CREATE INDEX "check_in_streak_grant_config_version_id_idx" ON "check_in_streak_grant" ("config_version_id");
CREATE INDEX "check_in_streak_grant_daily_rule_id_idx" ON "check_in_streak_grant" ("daily_rule_id");
CREATE INDEX "check_in_streak_grant_activity_id_idx" ON "check_in_streak_grant" ("activity_id");
CREATE INDEX "check_in_streak_grant_activity_rule_id_idx" ON "check_in_streak_grant" ("activity_rule_id");
CREATE INDEX "check_in_streak_grant_user_trigger_sign_date_idx" ON "check_in_streak_grant" ("user_id", "trigger_sign_date");
CREATE INDEX "check_in_streak_grant_reward_settlement_id_idx" ON "check_in_streak_grant" ("reward_settlement_id");

CREATE TABLE "check_in_streak_grant_reward_item" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "grant_id" integer NOT NULL,
  "asset_type" smallint NOT NULL,
  "asset_key" varchar(50) NOT NULL DEFAULT '',
  "amount" integer NOT NULL,
  "sort_order" smallint NOT NULL DEFAULT 0
);

ALTER TABLE "check_in_streak_grant_reward_item"
  ADD CONSTRAINT "check_in_streak_grant_reward_item_grant_id_positive_chk" CHECK ("grant_id" > 0),
  ADD CONSTRAINT "check_in_streak_grant_reward_item_asset_type_valid_chk" CHECK ("asset_type" in (1, 2)),
  ADD CONSTRAINT "check_in_streak_grant_reward_item_amount_positive_chk" CHECK ("amount" > 0),
  ADD CONSTRAINT "check_in_streak_grant_reward_item_sort_order_non_negative_chk" CHECK ("sort_order" >= 0);

CREATE INDEX "check_in_streak_grant_reward_item_grant_id_idx" ON "check_in_streak_grant_reward_item" ("grant_id");
