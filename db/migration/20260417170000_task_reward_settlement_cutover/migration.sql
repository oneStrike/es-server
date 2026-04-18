ALTER TABLE "task_assignment"
  ADD COLUMN "reward_applicable" smallint DEFAULT 0 NOT NULL;

ALTER TABLE "task_assignment"
  ADD COLUMN "reward_settlement_id" integer;

UPDATE "task_assignment"
SET "reward_applicable" = CASE
  WHEN (
    COALESCE((("task_snapshot" -> 'rewardConfig' ->> 'points')::integer), 0) > 0
    OR COALESCE((("task_snapshot" -> 'rewardConfig' ->> 'experience')::integer), 0) > 0
  ) THEN 1
  ELSE 0
END;

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
  "request_payload",
  "updated_at"
)
SELECT
  "ta"."user_id",
  CONCAT(
    'task:complete:',
    "ta"."task_id",
    ':assignment:',
    "ta"."id",
    ':user:',
    "ta"."user_id"
  ) AS "biz_key",
  2 AS "settlement_type",
  'task_bonus' AS "source",
  "ta"."id" AS "source_record_id",
  NULL AS "event_code",
  NULL AS "event_key",
  "ta"."task_id" AS "target_id",
  COALESCE("ta"."completed_at", "ta"."updated_at", "ta"."created_at") AS "event_occurred_at",
  CASE
    WHEN "ta"."reward_status" = 1 THEN 1
    ELSE 0
  END AS "settlement_status",
  CASE
    WHEN "ta"."reward_status" = 1 THEN COALESCE("ta"."reward_result_type", 1)
    WHEN "ta"."reward_status" = 2 THEN 3
    ELSE NULL
  END AS "settlement_result_type",
  COALESCE("ta"."reward_ledger_ids", ARRAY[]::integer[]) AS "ledger_record_ids",
  0 AS "retry_count",
  NULL AS "last_retry_at",
  CASE
    WHEN "ta"."reward_status" = 1 THEN "ta"."reward_settled_at"
    ELSE NULL
  END AS "settled_at",
  "ta"."last_reward_error" AS "last_error",
  jsonb_build_object(
    'kind', 'task_reward',
    'assignmentId', "ta"."id",
    'taskId', "ta"."task_id",
    'userId', "ta"."user_id",
    'rewardConfig', COALESCE("ta"."task_snapshot" -> 'rewardConfig', 'null'::jsonb),
    'occurredAt', to_char(
      COALESCE("ta"."completed_at", "ta"."updated_at", "ta"."created_at"),
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    )
  ) AS "request_payload",
  COALESCE("ta"."completed_at", "ta"."updated_at", "ta"."created_at") AS "updated_at"
FROM "task_assignment" AS "ta"
WHERE "ta"."reward_applicable" = 1;

UPDATE "task_assignment" AS "ta"
SET "reward_settlement_id" = "grs"."id"
FROM "growth_reward_settlement" AS "grs"
WHERE "grs"."settlement_type" = 2
  AND "grs"."source_record_id" = "ta"."id";

ALTER TABLE "task_assignment"
  ADD CONSTRAINT "task_assignment_reward_applicable_valid_chk"
  CHECK ("reward_applicable" in (0, 1));

ALTER TABLE "task_assignment"
  ADD CONSTRAINT "task_assignment_reward_settlement_id_positive_chk"
  CHECK ("reward_settlement_id" is null or "reward_settlement_id" > 0);

CREATE INDEX "task_assignment_reward_settlement_id_idx"
  ON "task_assignment" ("reward_settlement_id");

ALTER TABLE "task_assignment"
  DROP CONSTRAINT IF EXISTS "task_assignment_reward_status_valid_chk";

ALTER TABLE "task_assignment"
  DROP CONSTRAINT IF EXISTS "task_assignment_reward_result_type_valid_chk";

ALTER TABLE "task_assignment"
  DROP COLUMN "reward_status";

ALTER TABLE "task_assignment"
  DROP COLUMN "reward_result_type";

ALTER TABLE "task_assignment"
  DROP COLUMN "reward_settled_at";

ALTER TABLE "task_assignment"
  DROP COLUMN "reward_ledger_ids";

ALTER TABLE "task_assignment"
  DROP COLUMN "last_reward_error";
