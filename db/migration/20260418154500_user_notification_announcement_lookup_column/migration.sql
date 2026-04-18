ALTER TABLE "user_notification"
  ADD COLUMN "announcement_id" integer;

CREATE INDEX "user_notification_category_announcement_receiver_idx"
  ON "user_notification" ("category_key", "announcement_id", "receiver_user_id");

UPDATE "user_notification"
SET "announcement_id" = COALESCE(
  ("payload" -> 'object' ->> 'id')::integer,
  ("payload" ->> 'announcementId')::integer,
  ("payload" -> 'subject' ->> 'id')::integer
)
WHERE "category_key" = 'system_announcement';

ALTER TABLE "user_notification"
  ADD CONSTRAINT "user_notification_system_announcement_requires_announcement_id_chk"
  CHECK ("category_key" <> 'system_announcement' OR "announcement_id" IS NOT NULL);
