CREATE OR REPLACE FUNCTION "public"."convert_legacy_reward_config_to_items"("input" jsonb)
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT CASE
    WHEN "input" IS NULL THEN NULL
    WHEN jsonb_typeof("input") = 'array' THEN "input"
    WHEN jsonb_typeof("input") <> 'object' THEN NULL
    ELSE COALESCE(
      (
        SELECT jsonb_agg("item" ORDER BY "ord")
        FROM (
          SELECT
            1 AS "ord",
            jsonb_build_object(
              'assetType', 1,
              'assetKey', '',
              'amount', (("input" ->> 'points')::integer)
            ) AS "item"
          WHERE COALESCE((("input" ->> 'points')::integer), 0) > 0

          UNION ALL

          SELECT
            2 AS "ord",
            jsonb_build_object(
              'assetType', 2,
              'assetKey', '',
              'amount', (("input" ->> 'experience')::integer)
            ) AS "item"
          WHERE COALESCE((("input" ->> 'experience')::integer), 0) > 0
        ) AS "items"
      ),
      '[]'::jsonb
    )
  END;
$$;

ALTER TABLE "task"
  RENAME COLUMN "reward_config" TO "reward_items";

ALTER TABLE "check_in_record"
  RENAME COLUMN "resolved_reward_config" TO "resolved_reward_items";

ALTER TABLE "check_in_streak_reward_grant"
  RENAME COLUMN "reward_config" TO "reward_items";

UPDATE "task"
SET "reward_items" = "public"."convert_legacy_reward_config_to_items"("reward_items")
WHERE "reward_items" IS NOT NULL;

UPDATE "check_in_record"
SET "resolved_reward_items" = "public"."convert_legacy_reward_config_to_items"("resolved_reward_items")
WHERE "resolved_reward_items" IS NOT NULL;

UPDATE "check_in_streak_reward_grant"
SET "reward_items" = "public"."convert_legacy_reward_config_to_items"("reward_items")
WHERE "reward_items" IS NOT NULL;

UPDATE "task_assignment"
SET "task_snapshot" = jsonb_strip_nulls(
  ("task_snapshot" - 'rewardConfig' - 'rewardItems')
  || jsonb_build_object(
    'rewardItems',
    "public"."convert_legacy_reward_config_to_items"(
      COALESCE("task_snapshot" -> 'rewardItems', "task_snapshot" -> 'rewardConfig')
    )
  )
)
WHERE "task_snapshot" IS NOT NULL
  AND ("task_snapshot" ? 'rewardConfig' OR "task_snapshot" ? 'rewardItems');

UPDATE "task_assignment"
SET "reward_applicable" = CASE
  WHEN "task_snapshot" IS NOT NULL
    AND jsonb_array_length(COALESCE("task_snapshot" -> 'rewardItems', '[]'::jsonb)) > 0
  THEN 1
  ELSE 0
END;

UPDATE "growth_reward_settlement"
SET "request_payload" = jsonb_strip_nulls(
  ("request_payload" - 'rewardConfig' - 'rewardItems')
  || jsonb_build_object(
    'rewardItems',
    "public"."convert_legacy_reward_config_to_items"(
      COALESCE("request_payload" -> 'rewardItems', "request_payload" -> 'rewardConfig')
    )
  )
)
WHERE "settlement_type" IN (2, 3, 4);

UPDATE "check_in_plan"
SET "reward_definition" = jsonb_strip_nulls(
  ("reward_definition" - 'baseRewardConfig' - 'baseRewardItems')
  || jsonb_build_object(
    'baseRewardItems',
    "public"."convert_legacy_reward_config_to_items"(
      COALESCE("reward_definition" -> 'baseRewardItems', "reward_definition" -> 'baseRewardConfig')
    )
  )
  || jsonb_build_object(
    'dateRewardRules',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_strip_nulls(
            ("rule" - 'rewardConfig' - 'rewardItems')
            || jsonb_build_object(
              'rewardItems',
              "public"."convert_legacy_reward_config_to_items"(
                COALESCE("rule" -> 'rewardItems', "rule" -> 'rewardConfig')
              )
            )
          )
          ORDER BY "ord"
        )
        FROM jsonb_array_elements(COALESCE("reward_definition" -> 'dateRewardRules', '[]'::jsonb))
          WITH ORDINALITY AS "date_rules"("rule", "ord")
      ),
      '[]'::jsonb
    )
  )
  || jsonb_build_object(
    'patternRewardRules',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_strip_nulls(
            ("rule" - 'rewardConfig' - 'rewardItems')
            || jsonb_build_object(
              'rewardItems',
              "public"."convert_legacy_reward_config_to_items"(
                COALESCE("rule" -> 'rewardItems', "rule" -> 'rewardConfig')
              )
            )
          )
          ORDER BY "ord"
        )
        FROM jsonb_array_elements(COALESCE("reward_definition" -> 'patternRewardRules', '[]'::jsonb))
          WITH ORDINALITY AS "pattern_rules"("rule", "ord")
      ),
      '[]'::jsonb
    )
  )
  || jsonb_build_object(
    'streakRewardRules',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_strip_nulls(
            ("rule" - 'rewardConfig' - 'rewardItems')
            || jsonb_build_object(
              'rewardItems',
              "public"."convert_legacy_reward_config_to_items"(
                COALESCE("rule" -> 'rewardItems', "rule" -> 'rewardConfig')
              )
            )
          )
          ORDER BY "ord"
        )
        FROM jsonb_array_elements(COALESCE("reward_definition" -> 'streakRewardRules', '[]'::jsonb))
          WITH ORDINALITY AS "streak_rules"("rule", "ord")
      ),
      '[]'::jsonb
    )
  )
)
WHERE "reward_definition" IS NOT NULL;

DROP FUNCTION "public"."convert_legacy_reward_config_to_items"(jsonb);
