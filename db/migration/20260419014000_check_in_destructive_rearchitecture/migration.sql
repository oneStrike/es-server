DELETE FROM "growth_reward_settlement"
WHERE "settlement_type" IN (3, 4);

DROP TABLE IF EXISTS "check_in_streak_reward_grant";
DROP TABLE IF EXISTS "check_in_record";
DROP TABLE IF EXISTS "check_in_cycle";
DROP TABLE IF EXISTS "check_in_plan";
DROP TABLE IF EXISTS "check_in_streak_progress";
DROP TABLE IF EXISTS "check_in_streak_round_config";
DROP TABLE IF EXISTS "check_in_makeup_account";
DROP TABLE IF EXISTS "check_in_makeup_fact";
DROP TABLE IF EXISTS "check_in_config";

CREATE TABLE "check_in_config" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "enabled" smallint NOT NULL DEFAULT 1,
  "makeup_period_type" smallint NOT NULL,
  "periodic_allowance" integer NOT NULL DEFAULT 0,
  "base_reward_items" jsonb,
  "date_reward_rules" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "pattern_reward_rules" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "updated_by_id" integer,
  "created_at" timestamp(6) with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp(6) with time zone NOT NULL
);

ALTER TABLE "check_in_config"
  ADD CONSTRAINT "check_in_config_enabled_valid_chk" CHECK ("enabled" in (0, 1)),
  ADD CONSTRAINT "check_in_config_makeup_period_type_valid_chk" CHECK ("makeup_period_type" in (1, 2)),
  ADD CONSTRAINT "check_in_config_periodic_allowance_non_negative_chk" CHECK ("periodic_allowance" >= 0);

CREATE INDEX "check_in_config_enabled_idx" ON "check_in_config" ("enabled");

CREATE TABLE "check_in_makeup_fact" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" integer NOT NULL,
  "fact_type" smallint NOT NULL,
  "source_type" smallint NOT NULL,
  "amount" integer NOT NULL DEFAULT 0,
  "consumed_amount" integer NOT NULL DEFAULT 0,
  "effective_at" timestamp(6) with time zone NOT NULL,
  "expires_at" timestamp(6) with time zone,
  "period_type" smallint,
  "period_key" varchar(32),
  "source_ref" varchar(64),
  "biz_key" varchar(180) NOT NULL,
  "context" jsonb,
  "created_at" timestamp(6) with time zone NOT NULL DEFAULT now()
);

ALTER TABLE "check_in_makeup_fact"
  ADD CONSTRAINT "check_in_makeup_fact_type_valid_chk" CHECK ("fact_type" in (1, 2, 3)),
  ADD CONSTRAINT "check_in_makeup_fact_source_type_valid_chk" CHECK ("source_type" in (1, 2, 3)),
  ADD CONSTRAINT "check_in_makeup_fact_period_type_valid_chk" CHECK ("period_type" is null or "period_type" in (1, 2)),
  ADD CONSTRAINT "check_in_makeup_fact_amount_non_negative_chk" CHECK ("amount" >= 0),
  ADD CONSTRAINT "check_in_makeup_fact_consumed_amount_non_negative_chk" CHECK ("consumed_amount" >= 0),
  ADD CONSTRAINT "check_in_makeup_fact_biz_key_not_blank_chk" CHECK (btrim("biz_key") <> ''),
  ADD CONSTRAINT "check_in_makeup_fact_source_ref_not_blank_chk" CHECK ("source_ref" is null or btrim("source_ref") <> '');

CREATE UNIQUE INDEX "check_in_makeup_fact_user_biz_key_key" ON "check_in_makeup_fact" ("user_id", "biz_key");
CREATE INDEX "check_in_makeup_fact_user_id_created_at_idx" ON "check_in_makeup_fact" ("user_id", "created_at");
CREATE INDEX "check_in_makeup_fact_user_period_idx" ON "check_in_makeup_fact" ("user_id", "period_type", "period_key");

CREATE TABLE "check_in_makeup_account" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" integer NOT NULL,
  "period_type" smallint NOT NULL,
  "period_key" varchar(32) NOT NULL,
  "periodic_granted" integer NOT NULL DEFAULT 0,
  "periodic_used" integer NOT NULL DEFAULT 0,
  "event_available" integer NOT NULL DEFAULT 0,
  "version" integer NOT NULL DEFAULT 0,
  "last_synced_fact_id" integer,
  "created_at" timestamp(6) with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp(6) with time zone NOT NULL
);

ALTER TABLE "check_in_makeup_account"
  ADD CONSTRAINT "check_in_makeup_account_period_type_valid_chk" CHECK ("period_type" in (1, 2)),
  ADD CONSTRAINT "check_in_makeup_account_period_key_not_blank_chk" CHECK (btrim("period_key") <> ''),
  ADD CONSTRAINT "check_in_makeup_account_periodic_granted_non_negative_chk" CHECK ("periodic_granted" >= 0),
  ADD CONSTRAINT "check_in_makeup_account_periodic_used_non_negative_chk" CHECK ("periodic_used" >= 0),
  ADD CONSTRAINT "check_in_makeup_account_event_available_non_negative_chk" CHECK ("event_available" >= 0),
  ADD CONSTRAINT "check_in_makeup_account_periodic_used_not_gt_granted_chk" CHECK ("periodic_used" <= "periodic_granted"),
  ADD CONSTRAINT "check_in_makeup_account_version_non_negative_chk" CHECK ("version" >= 0);

CREATE UNIQUE INDEX "check_in_makeup_account_user_period_key_key" ON "check_in_makeup_account" ("user_id", "period_type", "period_key");
CREATE INDEX "check_in_makeup_account_user_id_idx" ON "check_in_makeup_account" ("user_id");

CREATE TABLE "check_in_streak_round_config" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "round_code" varchar(50) NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "status" smallint NOT NULL DEFAULT 1,
  "reward_rules" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "next_round_strategy" smallint NOT NULL DEFAULT 1,
  "next_round_config_id" integer,
  "updated_by_id" integer,
  "created_at" timestamp(6) with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp(6) with time zone NOT NULL
);

ALTER TABLE "check_in_streak_round_config"
  ADD CONSTRAINT "check_in_streak_round_config_round_code_not_blank_chk" CHECK (btrim("round_code") <> ''),
  ADD CONSTRAINT "check_in_streak_round_config_version_positive_chk" CHECK ("version" > 0),
  ADD CONSTRAINT "check_in_streak_round_config_status_valid_chk" CHECK ("status" in (0, 1, 2)),
  ADD CONSTRAINT "check_in_streak_round_config_next_round_strategy_valid_chk" CHECK ("next_round_strategy" in (1, 2)),
  ADD CONSTRAINT "check_in_streak_round_config_next_round_config_positive_chk" CHECK ("next_round_config_id" is null or "next_round_config_id" > 0);

CREATE UNIQUE INDEX "check_in_streak_round_config_round_code_version_key" ON "check_in_streak_round_config" ("round_code", "version");
CREATE INDEX "check_in_streak_round_config_status_idx" ON "check_in_streak_round_config" ("status");

CREATE TABLE "check_in_streak_progress" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" integer NOT NULL,
  "round_config_id" integer NOT NULL,
  "round_iteration" integer NOT NULL DEFAULT 1,
  "current_streak" integer NOT NULL DEFAULT 0,
  "round_started_at" date,
  "last_signed_date" date,
  "version" integer NOT NULL DEFAULT 0,
  "created_at" timestamp(6) with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp(6) with time zone NOT NULL
);

ALTER TABLE "check_in_streak_progress"
  ADD CONSTRAINT "check_in_streak_progress_round_config_positive_chk" CHECK ("round_config_id" > 0),
  ADD CONSTRAINT "check_in_streak_progress_round_iteration_positive_chk" CHECK ("round_iteration" > 0),
  ADD CONSTRAINT "check_in_streak_progress_current_streak_non_negative_chk" CHECK ("current_streak" >= 0),
  ADD CONSTRAINT "check_in_streak_progress_version_non_negative_chk" CHECK ("version" >= 0);

CREATE UNIQUE INDEX "check_in_streak_progress_user_id_key" ON "check_in_streak_progress" ("user_id");
CREATE INDEX "check_in_streak_progress_round_config_id_idx" ON "check_in_streak_progress" ("round_config_id");

CREATE TABLE "check_in_record" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" integer NOT NULL,
  "sign_date" date NOT NULL,
  "record_type" smallint NOT NULL,
  "resolved_reward_source_type" smallint,
  "resolved_reward_rule_key" varchar(32),
  "resolved_reward_items" jsonb,
  "reward_settlement_id" integer,
  "biz_key" varchar(180) NOT NULL,
  "operator_type" smallint NOT NULL,
  "remark" varchar(500),
  "context" jsonb,
  "created_at" timestamp(6) with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp(6) with time zone NOT NULL
);

ALTER TABLE "check_in_record"
  ADD CONSTRAINT "check_in_record_record_type_valid_chk" CHECK ("record_type" in (1, 2)),
  ADD CONSTRAINT "check_in_record_operator_type_valid_chk" CHECK ("operator_type" in (1, 2, 3)),
  ADD CONSTRAINT "check_in_record_reward_source_type_valid_chk" CHECK ("resolved_reward_source_type" is null or "resolved_reward_source_type" in (1, 2, 3)),
  ADD CONSTRAINT "check_in_record_reward_settlement_id_positive_chk" CHECK ("reward_settlement_id" is null or "reward_settlement_id" > 0),
  ADD CONSTRAINT "check_in_record_reward_resolution_consistent_chk" CHECK ((
    "resolved_reward_items" is null
    and "resolved_reward_source_type" is null
    and "resolved_reward_rule_key" is null
  ) or (
    "resolved_reward_items" is not null
    and "resolved_reward_source_type" in (1, 2, 3)
  ));

CREATE UNIQUE INDEX "check_in_record_user_sign_date_key" ON "check_in_record" ("user_id", "sign_date");
CREATE UNIQUE INDEX "check_in_record_user_biz_key_key" ON "check_in_record" ("user_id", "biz_key");
CREATE INDEX "check_in_record_user_id_sign_date_idx" ON "check_in_record" ("user_id", "sign_date");
CREATE INDEX "check_in_record_reward_settlement_id_idx" ON "check_in_record" ("reward_settlement_id");
CREATE INDEX "check_in_record_sign_date_idx" ON "check_in_record" ("sign_date");

CREATE TABLE "check_in_streak_reward_grant" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" integer NOT NULL,
  "round_config_id" integer NOT NULL,
  "round_iteration" integer NOT NULL DEFAULT 1,
  "rule_code" varchar(50) NOT NULL,
  "streak_days" integer NOT NULL,
  "reward_items" jsonb NOT NULL,
  "repeatable" boolean NOT NULL DEFAULT false,
  "trigger_sign_date" date NOT NULL,
  "reward_settlement_id" integer,
  "biz_key" varchar(200) NOT NULL,
  "context" jsonb,
  "created_at" timestamp(6) with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp(6) with time zone NOT NULL
);

ALTER TABLE "check_in_streak_reward_grant"
  ADD CONSTRAINT "check_in_streak_grant_reward_settlement_id_positive_chk" CHECK ("reward_settlement_id" is null or "reward_settlement_id" > 0),
  ADD CONSTRAINT "check_in_streak_grant_streak_days_positive_chk" CHECK ("streak_days" > 0),
  ADD CONSTRAINT "check_in_streak_grant_round_config_id_positive_chk" CHECK ("round_config_id" > 0),
  ADD CONSTRAINT "check_in_streak_grant_round_iteration_positive_chk" CHECK ("round_iteration" > 0);

CREATE UNIQUE INDEX "check_in_streak_grant_user_biz_key_key" ON "check_in_streak_reward_grant" ("user_id", "biz_key");
CREATE INDEX "check_in_streak_grant_round_config_id_idx" ON "check_in_streak_reward_grant" ("round_config_id");
CREATE INDEX "check_in_streak_grant_user_id_trigger_sign_date_idx" ON "check_in_streak_reward_grant" ("user_id", "trigger_sign_date");
CREATE INDEX "check_in_streak_grant_reward_settlement_id_idx" ON "check_in_streak_reward_grant" ("reward_settlement_id");
CREATE INDEX "check_in_streak_grant_rule_code_idx" ON "check_in_streak_reward_grant" ("rule_code");
CREATE INDEX "check_in_streak_grant_trigger_sign_date_idx" ON "check_in_streak_reward_grant" ("trigger_sign_date");

INSERT INTO "check_in_config" (
  "enabled",
  "makeup_period_type",
  "periodic_allowance",
  "base_reward_items",
  "date_reward_rules",
  "pattern_reward_rules",
  "updated_by_id",
  "updated_at"
) VALUES (
  0,
  1,
  0,
  NULL,
  '[]'::jsonb,
  '[]'::jsonb,
  NULL,
  now()
);

INSERT INTO "check_in_streak_round_config" (
  "round_code",
  "version",
  "status",
  "reward_rules",
  "next_round_strategy",
  "next_round_config_id",
  "updated_by_id",
  "updated_at"
) VALUES (
  'default-round',
  1,
  1,
  '[]'::jsonb,
  1,
  NULL,
  NULL,
  now()
);
