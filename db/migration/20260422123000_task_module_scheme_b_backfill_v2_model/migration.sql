INSERT INTO "task_definition" (
  "id",
  "code",
  "title",
  "description",
  "cover",
  "scene_type",
  "status",
  "priority",
  "claim_mode",
  "completion_policy",
  "repeat_type",
  "repeat_timezone",
  "start_at",
  "end_at",
  "reward_items",
  "created_by_id",
  "updated_by_id",
  "created_at",
  "updated_at",
  "deleted_at"
)
OVERRIDING SYSTEM VALUE
SELECT
  "t"."id",
  "t"."code",
  "t"."title",
  "t"."description",
  "t"."cover",
  "t"."type",
  CASE
    WHEN "t"."deleted_at" IS NOT NULL THEN 3
    WHEN "t"."status" = 0 THEN 0
    WHEN "t"."status" = 1 AND "t"."is_enabled" = true THEN 1
    WHEN "t"."status" = 1 AND "t"."is_enabled" = false THEN 2
    ELSE 3
  END,
  "t"."priority",
  "t"."claim_mode",
  1,
  CASE
    WHEN COALESCE("t"."repeat_rule" ->> 'type', 'once') = 'daily' THEN 1
    WHEN COALESCE("t"."repeat_rule" ->> 'type', 'once') = 'weekly' THEN 2
    WHEN COALESCE("t"."repeat_rule" ->> 'type', 'once') = 'monthly' THEN 3
    ELSE 0
  END,
  NULLIF(btrim(COALESCE("t"."repeat_rule" ->> 'timezone', '')), ''),
  "t"."publish_start_at",
  "t"."publish_end_at",
  "t"."reward_items",
  "t"."created_by_id",
  "t"."updated_by_id",
  "t"."created_at",
  "t"."updated_at",
  "t"."deleted_at"
FROM "task" AS "t"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "task_step" (
  "id",
  "task_id",
  "step_key",
  "title",
  "description",
  "step_no",
  "trigger_mode",
  "progress_mode",
  "event_code",
  "target_value",
  "template_key",
  "filter_payload",
  "unique_dimension_key",
  "dedupe_scope",
  "created_at",
  "updated_at"
)
OVERRIDING SYSTEM VALUE
SELECT
  "t"."id",
  "t"."id",
  'step_001',
  "t"."title",
  "t"."description",
  1,
  CASE
    WHEN "t"."objective_type" = 2 THEN 2
    ELSE 1
  END,
  CASE
    WHEN "t"."objective_type" = 1 AND COALESCE("t"."target_count", 1) = 1 THEN 1
    ELSE 2
  END,
  "t"."event_code",
  COALESCE("t"."target_count", 1),
  NULL,
  "t"."objective_config",
  NULL,
  NULL,
  "t"."created_at",
  "t"."updated_at"
FROM "task" AS "t"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "task_instance" (
  "id",
  "task_id",
  "user_id",
  "cycle_key",
  "status",
  "reward_applicable",
  "reward_settlement_id",
  "snapshot_payload",
  "context",
  "version",
  "claimed_at",
  "completed_at",
  "expired_at",
  "created_at",
  "updated_at",
  "deleted_at"
)
OVERRIDING SYSTEM VALUE
SELECT
  "ta"."id",
  "ta"."task_id",
  "ta"."user_id",
  "ta"."cycle_key",
  "ta"."status",
  "ta"."reward_applicable",
  "ta"."reward_settlement_id",
  "ta"."task_snapshot",
  "ta"."context",
  "ta"."version",
  "ta"."claimed_at",
  "ta"."completed_at",
  "ta"."expired_at",
  "ta"."created_at",
  "ta"."updated_at",
  "ta"."deleted_at"
FROM "task_assignment" AS "ta"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "task_instance_step" (
  "id",
  "instance_id",
  "step_id",
  "status",
  "current_value",
  "target_value",
  "completed_at",
  "context",
  "version",
  "created_at",
  "updated_at"
)
OVERRIDING SYSTEM VALUE
SELECT
  "ta"."id",
  "ta"."id",
  "ta"."task_id",
  "ta"."status",
  "ta"."progress",
  "ta"."target",
  "ta"."completed_at",
  "ta"."context",
  "ta"."version",
  "ta"."created_at",
  "ta"."updated_at"
FROM "task_assignment" AS "ta"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "task_event_log" (
  "id",
  "task_id",
  "step_id",
  "instance_id",
  "instance_step_id",
  "user_id",
  "event_code",
  "event_biz_key",
  "action_type",
  "progress_source",
  "accepted",
  "delta",
  "before_value",
  "after_value",
  "occurred_at",
  "context",
  "created_at"
)
OVERRIDING SYSTEM VALUE
SELECT
  "tpl"."id",
  "ta"."task_id",
  "ta"."task_id",
  "tpl"."assignment_id",
  "tpl"."assignment_id",
  "tpl"."user_id",
  "tpl"."event_code",
  "tpl"."event_biz_key",
  "tpl"."action_type",
  "tpl"."progress_source",
  true,
  "tpl"."delta",
  "tpl"."before_value",
  "tpl"."after_value",
  COALESCE("tpl"."event_occurred_at", "tpl"."created_at"),
  "tpl"."context",
  "tpl"."created_at"
FROM "task_progress_log" AS "tpl"
INNER JOIN "task_assignment" AS "ta"
  ON "ta"."id" = "tpl"."assignment_id"
ON CONFLICT ("id") DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('"task_definition"', 'id'),
  COALESCE((SELECT MAX("id") FROM "task_definition"), 1),
  true
);

SELECT setval(
  pg_get_serial_sequence('"task_step"', 'id'),
  COALESCE((SELECT MAX("id") FROM "task_step"), 1),
  true
);

SELECT setval(
  pg_get_serial_sequence('"task_instance"', 'id'),
  COALESCE((SELECT MAX("id") FROM "task_instance"), 1),
  true
);

SELECT setval(
  pg_get_serial_sequence('"task_instance_step"', 'id'),
  COALESCE((SELECT MAX("id") FROM "task_instance_step"), 1),
  true
);

SELECT setval(
  pg_get_serial_sequence('"task_event_log"', 'id'),
  COALESCE((SELECT MAX("id") FROM "task_event_log"), 1),
  true
);
