CREATE INDEX IF NOT EXISTS "forum_topic_visible_global_default_feed_idx"
  ON "forum_topic" (
    "is_pinned" DESC,
    "last_comment_at" DESC,
    "created_at" DESC,
    "id" DESC
  )
  WHERE "deleted_at" IS NULL
    AND "audit_status" = 1
    AND "is_hidden" = false;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_topic_visible_section_count_idx"
  ON "forum_topic" ("section_id")
  WHERE "deleted_at" IS NULL
    AND "audit_status" = 1
    AND "is_hidden" = false;
