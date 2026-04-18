ALTER TABLE "notification_delivery"
  ADD COLUMN "task_id" integer,
  ADD COLUMN "assignment_id" integer,
  ADD COLUMN "reminder_kind" varchar(40);

CREATE INDEX "notification_delivery_task_lookup_idx"
  ON "notification_delivery" ("category_key", "task_id", "updated_at" DESC, "id" DESC);

CREATE INDEX "notification_delivery_assignment_kind_idx"
  ON "notification_delivery" ("category_key", "assignment_id", "reminder_kind", "id" DESC);

CREATE INDEX "notification_delivery_kind_status_assignment_idx"
  ON "notification_delivery" ("category_key", "reminder_kind", "status", "assignment_id");

UPDATE "notification_delivery" AS "nd"
SET
  "task_id" = COALESCE(
    ("de"."context" -> 'payload' -> 'object' ->> 'id')::integer,
    ("de"."context" -> 'payload' ->> 'taskId')::integer,
    "de"."target_id"
  ),
  "assignment_id" = COALESCE(
    ("de"."context" -> 'payload' -> 'reminder' ->> 'assignmentId')::integer,
    ("de"."context" -> 'payload' ->> 'assignmentId')::integer
  ),
  "reminder_kind" = COALESCE(
    "de"."context" -> 'payload' -> 'reminder' ->> 'kind',
    CASE COALESCE("de"."context" -> 'payload' ->> 'reminderKind', '')
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
    END
  )
FROM "domain_event" AS "de"
WHERE "nd"."event_id" = "de"."id"
  AND "nd"."category_key" = 'task_reminder';

ALTER TABLE "notification_delivery"
  ADD CONSTRAINT "notification_delivery_task_reminder_lookup_required_chk"
  CHECK (
    "category_key" <> 'task_reminder'
    OR (
      "task_id" IS NOT NULL
      AND "assignment_id" IS NOT NULL
      AND "reminder_kind" IS NOT NULL
    )
  );
