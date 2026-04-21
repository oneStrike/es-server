DROP TABLE IF EXISTS "check_in_streak_grant_reward_item";
DROP TABLE IF EXISTS "check_in_streak_grant";
DROP TABLE IF EXISTS "check_in_streak_rule_reward_item";
DROP TABLE IF EXISTS "check_in_streak_rule";
DROP TABLE IF EXISTS "check_in_streak_config";

CREATE TABLE "check_in_streak_rule" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "rule_code" varchar(50) NOT NULL,
  "streak_days" integer NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "status" smallint NOT NULL DEFAULT 0,
  "publish_strategy" smallint NOT NULL,
  "effective_from" timestamp(6) with time zone NOT NULL,
  "effective_to" timestamp(6) with time zone,
  "repeatable" boolean NOT NULL DEFAULT false,
  "updated_by_id" integer,
  "created_at" timestamp(6) with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp(6) with time zone NOT NULL
);

ALTER TABLE "check_in_streak_rule"
  ADD CONSTRAINT "check_in_streak_rule_rule_code_version_key" UNIQUE ("rule_code", "version"),
  ADD CONSTRAINT "check_in_streak_rule_rule_code_effective_from_key" UNIQUE ("rule_code", "effective_from"),
  ADD CONSTRAINT "check_in_streak_rule_streak_days_positive_chk" CHECK ("streak_days" > 0),
  ADD CONSTRAINT "check_in_streak_rule_version_positive_chk" CHECK ("version" > 0),
  ADD CONSTRAINT "check_in_streak_rule_status_valid_chk" CHECK ("status" in (0, 1, 2, 3, 4)),
  ADD CONSTRAINT "check_in_streak_rule_publish_strategy_valid_chk" CHECK ("publish_strategy" in (1, 2, 3)),
  ADD CONSTRAINT "check_in_streak_rule_effective_window_valid_chk" CHECK ("effective_to" is null or "effective_to" > "effective_from"),
  ADD CONSTRAINT "check_in_streak_rule_rule_code_not_blank_chk" CHECK (btrim("rule_code") <> '');

CREATE INDEX "check_in_streak_rule_rule_code_idx" ON "check_in_streak_rule" ("rule_code");
CREATE INDEX "check_in_streak_rule_streak_days_idx" ON "check_in_streak_rule" ("streak_days");
CREATE INDEX "check_in_streak_rule_status_idx" ON "check_in_streak_rule" ("status");
CREATE INDEX "check_in_streak_rule_effective_from_idx" ON "check_in_streak_rule" ("effective_from");
CREATE INDEX "check_in_streak_rule_effective_to_idx" ON "check_in_streak_rule" ("effective_to");

CREATE TABLE "check_in_streak_rule_reward_item" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "rule_id" integer NOT NULL,
  "asset_type" smallint NOT NULL,
  "asset_key" varchar(50) NOT NULL DEFAULT '',
  "amount" integer NOT NULL,
  "sort_order" smallint NOT NULL DEFAULT 0
);

ALTER TABLE "check_in_streak_rule_reward_item"
  ADD CONSTRAINT "check_in_streak_rule_reward_item_rule_id_positive_chk" CHECK ("rule_id" > 0),
  ADD CONSTRAINT "check_in_streak_rule_reward_item_asset_type_valid_chk" CHECK ("asset_type" in (1, 2)),
  ADD CONSTRAINT "check_in_streak_rule_reward_item_amount_positive_chk" CHECK ("amount" > 0),
  ADD CONSTRAINT "check_in_streak_rule_reward_item_sort_order_non_negative_chk" CHECK ("sort_order" >= 0);

CREATE INDEX "check_in_streak_rule_reward_item_rule_id_idx" ON "check_in_streak_rule_reward_item" ("rule_id");

CREATE TABLE "check_in_streak_grant" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" integer NOT NULL,
  "rule_id" integer NOT NULL,
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
  ADD CONSTRAINT "check_in_streak_grant_rule_id_positive_chk" CHECK ("rule_id" > 0),
  ADD CONSTRAINT "check_in_streak_grant_streak_days_positive_chk" CHECK ("streak_days" > 0),
  ADD CONSTRAINT "check_in_streak_grant_reward_settlement_id_positive_chk" CHECK ("reward_settlement_id" is null or "reward_settlement_id" > 0);

CREATE INDEX "check_in_streak_grant_rule_id_idx" ON "check_in_streak_grant" ("rule_id");
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
