UPDATE "check_in_plan"
SET "plan_code" = CONCAT('legacy-check-in-plan-', "id")
WHERE "plan_code" IS NULL
   OR btrim("plan_code") = '';

UPDATE "check_in_plan"
SET "plan_name" = CONCAT('签到计划-', "id")
WHERE "plan_name" IS NULL
   OR btrim("plan_name") = '';

UPDATE "check_in_plan"
SET "reward_definition" = jsonb_set(
  "reward_definition",
  '{patternRewardRules}',
  COALESCE((
    SELECT jsonb_agg(pattern_rule.value ORDER BY pattern_rule.ordinality)
    FROM (
      SELECT
        rules.value,
        rules.ordinality,
        sum(
          CASE
            WHEN rules.value ->> 'patternType' = '3' THEN 1
            ELSE 0
          END
        ) OVER (ORDER BY rules.ordinality) AS month_last_day_rank
      FROM jsonb_array_elements(
        COALESCE(
          "check_in_plan"."reward_definition" -> 'patternRewardRules',
          '[]'::jsonb
        )
      ) WITH ORDINALITY AS rules(value, ordinality)
    ) AS pattern_rule
    WHERE pattern_rule.value ->> 'patternType' <> '3'
       OR pattern_rule.month_last_day_rank = 1
  ), '[]'::jsonb),
  false
)
WHERE "reward_definition" IS NOT NULL
  AND jsonb_typeof("reward_definition" -> 'patternRewardRules') = 'array'
  AND (
    SELECT count(*)
    FROM jsonb_array_elements(
      COALESCE(
        "check_in_plan"."reward_definition" -> 'patternRewardRules',
        '[]'::jsonb
      )
    ) AS rules(value)
    WHERE rules.value ->> 'patternType' = '3'
  ) > 1;

ALTER TABLE "check_in_plan"
  ADD CONSTRAINT "check_in_plan_plan_code_not_blank_chk"
  CHECK (btrim("plan_code") <> '');

ALTER TABLE "check_in_plan"
  ADD CONSTRAINT "check_in_plan_plan_name_not_blank_chk"
  CHECK (btrim("plan_name") <> '');
