CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_comment_forum_topic_content_trgm_idx"
  ON "user_comment" USING gin ("content" gin_trgm_ops)
  WHERE "target_type" = 5
    AND "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_hashtag_slug_lower_trgm_idx"
  ON "forum_hashtag" USING gin (lower("slug") gin_trgm_ops)
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_hashtag_display_name_lower_trgm_idx"
  ON "forum_hashtag" USING gin (lower("display_name") gin_trgm_ops)
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_message_conversation_live_seq_idx"
  ON "chat_message" ("conversation_id", "message_seq")
  WHERE "status" IN (1, 2);
