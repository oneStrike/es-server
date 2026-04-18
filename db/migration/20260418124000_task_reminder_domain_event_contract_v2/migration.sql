WITH "task_source" AS (
  SELECT
    "de"."id",
    COALESCE(("de"."context" -> 'payload' -> 'object' ->> 'id')::integer, ("de"."context" -> 'payload' ->> 'taskId')::integer, "de"."target_id") AS "task_id",
    "t"."title" AS "task_title",
    "t"."cover" AS "task_cover",
    "t"."code" AS "task_code",
    "t"."type" AS "task_type"
  FROM "domain_event" AS "de"
  LEFT JOIN "task" AS "t"
    ON "t"."id" = COALESCE(("de"."context" -> 'payload' -> 'object' ->> 'id')::integer, ("de"."context" -> 'payload' ->> 'taskId')::integer, "de"."target_id")
   AND "t"."deleted_at" IS NULL
  WHERE "de"."event_key" IN ('task.reminder.auto_assigned', 'task.reminder.expiring', 'task.reminder.reward_granted')
)
UPDATE "domain_event" AS "de"
SET "context" = jsonb_set(
  COALESCE("de"."context", '{}'::jsonb),
  '{payload}',
  jsonb_strip_nulls(
    jsonb_build_object(
      'object',
      jsonb_strip_nulls(
        jsonb_build_object(
          'kind', 'task',
          'id', "s"."task_id",
          'code', COALESCE("s"."task_code", "de"."context" -> 'payload' -> 'object' ->> 'code', "de"."context" -> 'payload' ->> 'taskCode'),
          'title', COALESCE("s"."task_title", "de"."context" -> 'payload' -> 'object' ->> 'title', "de"."context" ->> 'title'),
          'cover', COALESCE("s"."task_cover", "de"."context" -> 'payload' -> 'object' ->> 'cover'),
          'sceneType', COALESCE("s"."task_type", ("de"."context" -> 'payload' -> 'object' ->> 'sceneType')::integer, ("de"."context" -> 'payload' ->> 'sceneType')::integer)
        )
      ),
      'reminder',
      jsonb_strip_nulls(
        jsonb_build_object(
          'kind',
          CASE COALESCE("de"."context" -> 'payload' -> 'reminder' ->> 'kind', "de"."context" -> 'payload' ->> 'reminderKind')
            WHEN 'task_auto_assigned' THEN 'auto_assigned'
            WHEN 'auto_assigned' THEN 'auto_assigned'
            WHEN 'task_expiring_soon' THEN 'expiring_soon'
            WHEN 'expiring_soon' THEN 'expiring_soon'
            WHEN 'task_reward_granted' THEN 'reward_granted'
            WHEN 'reward_granted' THEN 'reward_granted'
            ELSE CASE "de"."event_key"
              WHEN 'task.reminder.auto_assigned' THEN 'auto_assigned'
              WHEN 'task.reminder.expiring' THEN 'expiring_soon'
              WHEN 'task.reminder.reward_granted' THEN 'reward_granted'
              ELSE NULL
            END
          END,
          'assignmentId', COALESCE(("de"."context" -> 'payload' -> 'reminder' ->> 'assignmentId')::integer, ("de"."context" -> 'payload' ->> 'assignmentId')::integer),
          'cycleKey', COALESCE("de"."context" -> 'payload' -> 'reminder' ->> 'cycleKey', "de"."context" -> 'payload' ->> 'cycleKey'),
          'expiredAt', COALESCE("de"."context" -> 'payload' -> 'reminder' ->> 'expiredAt', "de"."context" -> 'payload' ->> 'expiredAt', "de"."context" ->> 'expiresAt')
        )
      )
    )
    || CASE
      WHEN jsonb_typeof("de"."context" -> 'payload' -> 'reward') = 'object' THEN jsonb_build_object('reward', "de"."context" -> 'payload' -> 'reward')
      WHEN jsonb_typeof("de"."context" -> 'payload' -> 'rewardSummary') = 'object' THEN jsonb_build_object(
        'reward',
        jsonb_strip_nulls(
          jsonb_build_object(
            'items', COALESCE("de"."context" -> 'payload' -> 'rewardSummary' -> 'items', "de"."context" -> 'payload' -> 'rewardSummary' -> 'rewardItems', '[]'::jsonb),
            'ledgerRecordIds', COALESCE("de"."context" -> 'payload' -> 'rewardSummary' -> 'ledgerRecordIds', "de"."context" -> 'payload' -> 'ledgerRecordIds', '[]'::jsonb)
          )
        )
      )
      WHEN COALESCE(("de"."context" -> 'payload' ->> 'points')::integer, 0) > 0
        OR COALESCE(("de"."context" -> 'payload' ->> 'experience')::integer, 0) > 0
        OR jsonb_typeof("de"."context" -> 'payload' -> 'ledgerRecordIds') = 'array'
      THEN jsonb_build_object(
        'reward',
        jsonb_strip_nulls(
          jsonb_build_object(
            'items',
            (
              CASE
                WHEN COALESCE(("de"."context" -> 'payload' ->> 'points')::integer, 0) > 0 THEN jsonb_build_array(
                  jsonb_build_object(
                    'assetType', 1,
                    'amount', ("de"."context" -> 'payload' ->> 'points')::integer
                  )
                )
                ELSE '[]'::jsonb
              END
              ||
              CASE
                WHEN COALESCE(("de"."context" -> 'payload' ->> 'experience')::integer, 0) > 0 THEN jsonb_build_array(
                  jsonb_build_object(
                    'assetType', 2,
                    'amount', ("de"."context" -> 'payload' ->> 'experience')::integer
                  )
                )
                ELSE '[]'::jsonb
              END
            ),
            'ledgerRecordIds', COALESCE("de"."context" -> 'payload' -> 'ledgerRecordIds', '[]'::jsonb)
          )
        )
      )
      ELSE '{}'::jsonb
    END
  ),
  true
)
FROM "task_source" AS "s"
WHERE "de"."id" = "s"."id";

UPDATE "domain_event" AS "de"
SET "context" = jsonb_set(
  COALESCE("de"."context", '{}'::jsonb),
  '{payload,reward,items}',
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'assetType',
          CASE "item" ->> 'assetType'
            WHEN 'points' THEN 1
            WHEN 'experience' THEN 2
            WHEN '1' THEN 1
            WHEN '2' THEN 2
            ELSE NULL
          END,
          'amount', ("item" ->> 'amount')::integer
        )
      )
      FROM jsonb_array_elements(COALESCE("de"."context" -> 'payload' -> 'reward' -> 'items', '[]'::jsonb)) AS "item"
      WHERE CASE "item" ->> 'assetType'
        WHEN 'points' THEN 1
        WHEN 'experience' THEN 2
        WHEN '1' THEN 1
        WHEN '2' THEN 2
        ELSE NULL
      END IS NOT NULL
    ),
    '[]'::jsonb
  ),
  true
)
WHERE "de"."event_key" IN ('task.reminder.auto_assigned', 'task.reminder.expiring', 'task.reminder.reward_granted')
  AND jsonb_typeof("de"."context" -> 'payload' -> 'reward' -> 'items') = 'array';
