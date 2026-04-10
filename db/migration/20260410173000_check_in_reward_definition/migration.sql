ALTER TABLE "check_in_plan"
ADD COLUMN "reward_definition" jsonb;

UPDATE "check_in_plan" AS plan
SET "reward_definition" = CASE
  WHEN plan."base_reward_config" IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "check_in_date_reward_rule" AS rule
      WHERE rule."plan_id" = plan."id"
        AND rule."plan_version" = plan."version"
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "check_in_pattern_reward_rule" AS rule
      WHERE rule."plan_id" = plan."id"
        AND rule."plan_version" = plan."version"
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "check_in_streak_reward_rule" AS rule
      WHERE rule."plan_id" = plan."id"
        AND rule."plan_version" = plan."version"
        AND rule."deleted_at" IS NULL
    )
  THEN NULL
  ELSE jsonb_build_object(
    'baseRewardConfig',
    plan."base_reward_config",
    'dateRewardRules',
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'rewardDate', rule."reward_date",
          'rewardConfig', rule."reward_config"
        )
        ORDER BY rule."reward_date", rule."id"
      )
      FROM "check_in_date_reward_rule" AS rule
      WHERE rule."plan_id" = plan."id"
        AND rule."plan_version" = plan."version"
    ), '[]'::jsonb),
    'patternRewardRules',
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'patternType', rule."pattern_type",
          'weekday', rule."weekday",
          'monthDay', rule."month_day",
          'rewardConfig', rule."reward_config"
        )
        ORDER BY rule."pattern_type", rule."weekday", rule."month_day", rule."id"
      )
      FROM "check_in_pattern_reward_rule" AS rule
      WHERE rule."plan_id" = plan."id"
        AND rule."plan_version" = plan."version"
    ), '[]'::jsonb),
    'streakRewardRules',
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'ruleCode', rule."rule_code",
          'streakDays', rule."streak_days",
          'rewardConfig', rule."reward_config",
          'repeatable', rule."repeatable",
          'status', rule."status"
        )
        ORDER BY rule."streak_days", rule."rule_code", rule."id"
      )
      FROM "check_in_streak_reward_rule" AS rule
      WHERE rule."plan_id" = plan."id"
        AND rule."plan_version" = plan."version"
        AND rule."deleted_at" IS NULL
    ), '[]'::jsonb)
  )
END;

ALTER TABLE "check_in_record"
DROP CONSTRAINT IF EXISTS "check_in_record_reward_resolution_consistent_chk";

ALTER TABLE "check_in_record"
ADD COLUMN "resolved_reward_rule_key" varchar(32);

UPDATE "check_in_record" AS record
SET "resolved_reward_rule_key" = 'DATE:' || rule."reward_date"::text
FROM "check_in_date_reward_rule" AS rule
WHERE record."resolved_reward_source_type" = 'DATE_RULE'
  AND record."resolved_reward_rule_id" = rule."id";

UPDATE "check_in_record" AS record
SET "resolved_reward_rule_key" = CASE
  WHEN rule."pattern_type" = 'WEEKDAY' THEN 'WEEKDAY:' || rule."weekday"::text
  WHEN rule."pattern_type" = 'MONTH_DAY' THEN 'MONTH_DAY:' || rule."month_day"::text
  ELSE 'MONTH_LAST_DAY'
END
FROM "check_in_pattern_reward_rule" AS rule
WHERE record."resolved_reward_source_type" = 'PATTERN_RULE'
  AND record."resolved_reward_rule_id" = rule."id";

ALTER TABLE "check_in_streak_reward_grant"
ADD COLUMN "rule_code" varchar(50),
ADD COLUMN "streak_days" integer,
ADD COLUMN "reward_config" jsonb,
ADD COLUMN "repeatable" boolean DEFAULT false;

UPDATE "check_in_streak_reward_grant" AS grant
SET "rule_code" = rule."rule_code",
    "streak_days" = rule."streak_days",
    "reward_config" = rule."reward_config",
    "repeatable" = rule."repeatable"
FROM "check_in_streak_reward_rule" AS rule
WHERE grant."rule_id" = rule."id";

DROP INDEX IF EXISTS "check_in_streak_grant_rule_id_idx";

ALTER TABLE "check_in_plan"
DROP CONSTRAINT IF EXISTS "check_in_plan_version_positive_chk",
DROP COLUMN IF EXISTS "base_reward_config",
DROP COLUMN IF EXISTS "version";

ALTER TABLE "check_in_cycle"
DROP CONSTRAINT IF EXISTS "check_in_cycle_snapshot_version_positive_chk",
DROP COLUMN IF EXISTS "plan_snapshot_version",
DROP COLUMN IF EXISTS "plan_snapshot";

ALTER TABLE "check_in_record"
DROP COLUMN IF EXISTS "resolved_reward_rule_id";

ALTER TABLE "check_in_record"
ADD CONSTRAINT "check_in_record_reward_resolution_consistent_chk"
CHECK (
  (
    "reward_status" IS NULL
    AND "resolved_reward_source_type" IS NULL
    AND "resolved_reward_rule_key" IS NULL
    AND "resolved_reward_config" IS NULL
  ) OR (
    "reward_status" IN (0, 1, 2)
    AND "resolved_reward_source_type" IN ('BASE_REWARD', 'DATE_RULE', 'PATTERN_RULE')
    AND (
      ("resolved_reward_source_type" = 'BASE_REWARD' AND "resolved_reward_rule_key" IS NULL)
      OR ("resolved_reward_source_type" IN ('DATE_RULE', 'PATTERN_RULE') AND "resolved_reward_rule_key" IS NOT NULL)
    )
    AND "resolved_reward_config" IS NOT NULL
  )
);

ALTER TABLE "check_in_streak_reward_grant"
DROP CONSTRAINT IF EXISTS "check_in_streak_grant_snapshot_version_positive_chk",
DROP COLUMN IF EXISTS "rule_id",
DROP COLUMN IF EXISTS "plan_snapshot_version";

ALTER TABLE "check_in_streak_reward_grant"
ALTER COLUMN "rule_code" SET NOT NULL,
ALTER COLUMN "streak_days" SET NOT NULL,
ALTER COLUMN "reward_config" SET NOT NULL,
ALTER COLUMN "repeatable" SET NOT NULL;

CREATE INDEX "check_in_streak_grant_rule_code_idx"
ON "check_in_streak_reward_grant" ("rule_code");

ALTER TABLE "check_in_streak_reward_grant"
ADD CONSTRAINT "check_in_streak_grant_streak_days_positive_chk"
CHECK ("streak_days" > 0);

DROP TABLE IF EXISTS "check_in_date_reward_rule";
DROP TABLE IF EXISTS "check_in_pattern_reward_rule";
DROP TABLE IF EXISTS "check_in_streak_reward_rule";
