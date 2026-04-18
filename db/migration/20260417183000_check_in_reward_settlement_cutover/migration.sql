ALTER TABLE "growth_reward_settlement"
  DROP CONSTRAINT IF EXISTS "growth_reward_settlement_type_valid_chk";

ALTER TABLE "growth_reward_settlement"
  ADD CONSTRAINT "growth_reward_settlement_type_valid_chk"
  CHECK ("settlement_type" in (1, 2, 3, 4));

ALTER TABLE "check_in_record"
  ADD COLUMN IF NOT EXISTS "reward_settlement_id" integer;

ALTER TABLE "check_in_streak_reward_grant"
  ADD COLUMN IF NOT EXISTS "reward_settlement_id" integer;

INSERT INTO "growth_reward_settlement" (
  "user_id",
  "biz_key",
  "settlement_type",
  "source",
  "source_record_id",
  "event_code",
  "event_key",
  "target_id",
  "event_occurred_at",
  "settlement_status",
  "settlement_result_type",
  "ledger_record_ids",
  "retry_count",
  "last_retry_at",
  "settled_at",
  "last_error",
  "request_payload"
)
SELECT
  "cir"."user_id",
  CONCAT('checkin:base:record:', "cir"."id", ':user:', "cir"."user_id"),
  3,
  'check_in_base_bonus',
  "cir"."id",
  NULL,
  NULL,
  "cir"."plan_id",
  COALESCE("cir"."reward_settled_at", "cir"."created_at"),
  CASE
    WHEN "cir"."reward_status" = 1 THEN 1
    WHEN "cir"."reward_status" = 2 THEN 0
    ELSE 0
  END,
  CASE
    WHEN "cir"."reward_status" = 1 THEN COALESCE("cir"."reward_result_type", 1)
    WHEN "cir"."reward_status" = 2 THEN 3
    ELSE NULL
  END,
  COALESCE("cir"."base_reward_ledger_ids", ARRAY[]::integer[]),
  0,
  NULL,
  CASE WHEN "cir"."reward_status" = 1 THEN "cir"."reward_settled_at" ELSE NULL END,
  "cir"."last_reward_error",
  jsonb_build_object(
    'kind', 'check_in_record_reward',
    'recordId', "cir"."id",
    'userId', "cir"."user_id",
    'planId', "cir"."plan_id",
    'cycleId', "cir"."cycle_id",
    'signDate', "cir"."sign_date",
    'rewardConfig', COALESCE("cir"."resolved_reward_config", 'null'::jsonb)
  )
FROM "check_in_record" AS "cir"
WHERE "cir"."resolved_reward_config" IS NOT NULL;

INSERT INTO "growth_reward_settlement" (
  "user_id",
  "biz_key",
  "settlement_type",
  "source",
  "source_record_id",
  "event_code",
  "event_key",
  "target_id",
  "event_occurred_at",
  "settlement_status",
  "settlement_result_type",
  "ledger_record_ids",
  "retry_count",
  "last_retry_at",
  "settled_at",
  "last_error",
  "request_payload"
)
SELECT
  "grant"."user_id",
  CONCAT(
    'checkin:streak:grant:',
    "grant"."id",
    ':rule:',
    "grant"."rule_code",
    ':user:',
    "grant"."user_id"
  ),
  4,
  'check_in_streak_bonus',
  "grant"."id",
  NULL,
  NULL,
  "grant"."plan_id",
  COALESCE("grant"."grant_settled_at", "grant"."created_at"),
  CASE
    WHEN "grant"."grant_status" = 1 THEN 1
    WHEN "grant"."grant_status" = 2 THEN 0
    ELSE 0
  END,
  CASE
    WHEN "grant"."grant_status" = 1 THEN COALESCE("grant"."grant_result_type", 1)
    WHEN "grant"."grant_status" = 2 THEN 3
    ELSE NULL
  END,
  COALESCE("grant"."ledger_ids", ARRAY[]::integer[]),
  0,
  NULL,
  CASE WHEN "grant"."grant_status" = 1 THEN "grant"."grant_settled_at" ELSE NULL END,
  "grant"."last_grant_error",
  jsonb_build_object(
    'kind', 'check_in_streak_reward',
    'grantId', "grant"."id",
    'userId', "grant"."user_id",
    'planId', "grant"."plan_id",
    'cycleId', "grant"."cycle_id",
    'ruleCode', "grant"."rule_code",
    'triggerSignDate', "grant"."trigger_sign_date",
    'rewardConfig', "grant"."reward_config"
  )
FROM "check_in_streak_reward_grant" AS "grant";

UPDATE "check_in_record" AS "cir"
SET "reward_settlement_id" = "grs"."id"
FROM "growth_reward_settlement" AS "grs"
WHERE "grs"."settlement_type" = 3
  AND "grs"."source_record_id" = "cir"."id";

UPDATE "check_in_streak_reward_grant" AS "grant"
SET "reward_settlement_id" = "grs"."id"
FROM "growth_reward_settlement" AS "grs"
WHERE "grs"."settlement_type" = 4
  AND "grs"."source_record_id" = "grant"."id";

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_in_record_reward_settlement_id_positive_chk'
  ) THEN
    ALTER TABLE "check_in_record"
      ADD CONSTRAINT "check_in_record_reward_settlement_id_positive_chk"
      CHECK ("reward_settlement_id" is null or "reward_settlement_id" > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "check_in_record_reward_settlement_id_idx"
  ON "check_in_record" ("reward_settlement_id");

ALTER TABLE "check_in_record"
  DROP CONSTRAINT IF EXISTS "check_in_record_reward_state_consistent_chk";

ALTER TABLE "check_in_record"
  DROP CONSTRAINT IF EXISTS "check_in_record_reward_status_valid_chk";

ALTER TABLE "check_in_record"
  DROP CONSTRAINT IF EXISTS "check_in_record_reward_result_type_valid_chk";

ALTER TABLE "check_in_record"
  DROP COLUMN "reward_status";

ALTER TABLE "check_in_record"
  DROP COLUMN "reward_result_type";

ALTER TABLE "check_in_record"
  DROP COLUMN "base_reward_ledger_ids";

ALTER TABLE "check_in_record"
  DROP COLUMN "last_reward_error";

ALTER TABLE "check_in_record"
  DROP COLUMN "reward_settled_at";

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_in_streak_grant_reward_settlement_id_positive_chk'
  ) THEN
    ALTER TABLE "check_in_streak_reward_grant"
      ADD CONSTRAINT "check_in_streak_grant_reward_settlement_id_positive_chk"
      CHECK ("reward_settlement_id" is null or "reward_settlement_id" > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "check_in_streak_grant_reward_settlement_id_idx"
  ON "check_in_streak_reward_grant" ("reward_settlement_id");

ALTER TABLE "check_in_streak_reward_grant"
  DROP CONSTRAINT IF EXISTS "check_in_streak_grant_status_valid_chk";

ALTER TABLE "check_in_streak_reward_grant"
  DROP CONSTRAINT IF EXISTS "check_in_streak_grant_result_type_valid_chk";

ALTER TABLE "check_in_streak_reward_grant"
  DROP CONSTRAINT IF EXISTS "check_in_streak_grant_state_consistent_chk";

ALTER TABLE "check_in_streak_reward_grant"
  DROP COLUMN "grant_status";

ALTER TABLE "check_in_streak_reward_grant"
  DROP COLUMN "grant_result_type";

ALTER TABLE "check_in_streak_reward_grant"
  DROP COLUMN "ledger_ids";

ALTER TABLE "check_in_streak_reward_grant"
  DROP COLUMN "last_grant_error";

ALTER TABLE "check_in_streak_reward_grant"
  DROP COLUMN "grant_settled_at";
