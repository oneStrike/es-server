ALTER TABLE "chat_conversation_member"
  ADD COLUMN "is_pinned" boolean DEFAULT false NOT NULL;

ALTER TABLE "chat_conversation_member"
  ADD COLUMN "hidden_at" timestamp(6) with time zone;

ALTER TABLE "user_notification"
  ADD COLUMN "is_hidden" boolean DEFAULT false NOT NULL;

ALTER TABLE "message_ws_metric"
  ADD COLUMN "fanout_skipped_count" integer DEFAULT 0 NOT NULL;

ALTER TABLE "message_ws_metric"
  ADD COLUMN "fanout_publish_error_count" integer DEFAULT 0 NOT NULL;

DROP INDEX IF EXISTS "chat_conversation_member_user_id_joined_at_idx";
CREATE INDEX IF NOT EXISTS "chat_conversation_member_user_id_joined_at_idx"
  ON "chat_conversation_member" ("user_id", "is_pinned" DESC, "joined_at", "conversation_id");

DROP INDEX IF EXISTS "chat_conversation_member_active_user_idx";
CREATE INDEX IF NOT EXISTS "chat_conversation_member_active_user_idx"
  ON "chat_conversation_member" ("user_id", "is_pinned" DESC, "conversation_id")
  WHERE "left_at" IS NULL AND "hidden_at" IS NULL;

DROP INDEX IF EXISTS "chat_conversation_member_active_unread_idx";
CREATE INDEX IF NOT EXISTS "chat_conversation_member_active_unread_idx"
  ON "chat_conversation_member" ("user_id", "unread_count", "conversation_id")
  WHERE "left_at" IS NULL AND "hidden_at" IS NULL;

DROP INDEX IF EXISTS "chat_conversation_member_hidden_user_idx";
CREATE INDEX IF NOT EXISTS "chat_conversation_member_hidden_user_idx"
  ON "chat_conversation_member" ("user_id", "hidden_at" DESC, "conversation_id")
  WHERE "left_at" IS NULL AND "hidden_at" IS NOT NULL;

DROP INDEX IF EXISTS "user_notification_receiver_user_id_is_read_created_at_idx";
CREATE INDEX IF NOT EXISTS "user_notification_receiver_user_id_is_read_created_at_idx"
  ON "user_notification" ("receiver_user_id", "is_hidden", "is_read", "created_at" DESC);

DROP INDEX IF EXISTS "user_notification_receiver_user_id_category_key_created_at_idx";
CREATE INDEX IF NOT EXISTS "user_notification_receiver_user_id_category_key_created_at_idx"
  ON "user_notification" ("receiver_user_id", "is_hidden", "category_key", "created_at" DESC);

DROP INDEX IF EXISTS "user_notification_receiver_user_id_created_at_idx";
CREATE INDEX IF NOT EXISTS "user_notification_receiver_user_id_created_at_idx"
  ON "user_notification" ("receiver_user_id", "is_hidden", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "notification_delivery_status_updated_at_id_idx"
  ON "notification_delivery" ("status", "updated_at" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "notification_delivery_updated_at_id_idx"
  ON "notification_delivery" ("updated_at" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "notification_delivery_category_status_updated_at_id_idx"
  ON "notification_delivery" ("category_key", "status", "updated_at" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "notification_delivery_receiver_updated_at_id_idx"
  ON "notification_delivery" ("receiver_user_id", "updated_at" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "domain_event_dispatch_consumer_status_updated_at_id_idx"
  ON "domain_event_dispatch" ("consumer", "status", "updated_at" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "notification_template_enabled_updated_at_id_idx"
  ON "notification_template" ("is_enabled", "updated_at" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "notification_template_category_updated_at_id_idx"
  ON "notification_template" ("category_key", "updated_at" DESC, "id" DESC);
