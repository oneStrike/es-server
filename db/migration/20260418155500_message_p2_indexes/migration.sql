CREATE INDEX "notification_delivery_event_key_updated_at_idx"
  ON "notification_delivery" ("event_key", "updated_at" DESC);

CREATE INDEX "notification_delivery_projection_key_idx"
  ON "notification_delivery" ("projection_key");

CREATE INDEX "domain_event_dispatch_updated_at_id_idx"
  ON "domain_event_dispatch" ("updated_at" DESC, "id" DESC);

CREATE INDEX "chat_conversation_member_active_user_idx"
  ON "chat_conversation_member" ("user_id", "conversation_id")
  WHERE "left_at" IS NULL;

CREATE INDEX "chat_conversation_member_active_unread_idx"
  ON "chat_conversation_member" ("user_id", "unread_count", "conversation_id")
  WHERE "left_at" IS NULL;
