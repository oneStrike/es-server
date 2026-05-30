CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_topic_visible_default_feed_idx"
  ON "forum_topic" (
    "section_id",
    "is_pinned" DESC,
    "last_comment_at" DESC,
    "created_at" DESC,
    "id" DESC
  )
  WHERE "deleted_at" IS NULL
    AND "audit_status" = 1
    AND "is_hidden" = false;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_topic_visible_hot_feed_idx"
  ON "forum_topic" (
    "section_id",
    "comment_count" DESC,
    "like_count" DESC,
    "view_count" DESC,
    "created_at" DESC,
    "id" DESC
  )
  WHERE "deleted_at" IS NULL
    AND "audit_status" = 1
    AND "is_hidden" = false;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_topic_section_visible_activity_idx"
  ON "forum_topic" (
    "section_id",
    (coalesce("last_comment_at", "created_at")) DESC,
    "id" DESC
  )
  WHERE "deleted_at" IS NULL
    AND "audit_status" = 1
    AND "is_hidden" = false;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_topic_title_trgm_idx"
  ON "forum_topic" USING gin ("title" gin_trgm_ops)
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_topic_content_trgm_idx"
  ON "forum_topic" USING gin ("content" gin_trgm_ops)
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_hashtag_ref_visible_topic_feed_idx"
  ON "forum_hashtag_reference" (
    "hashtag_id",
    "section_id",
    "topic_id"
  )
  WHERE "source_type" = 1
    AND "is_source_visible" = true;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_hashtag_ref_comment_topic_cleanup_idx"
  ON "forum_hashtag_reference" (
    "topic_id",
    "source_id"
  )
  WHERE "source_type" = 2;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_comment_forum_topic_visible_latest_idx"
  ON "user_comment" (
    "target_id",
    "created_at" DESC,
    "id" DESC
  )
  WHERE "target_type" = 5
    AND "audit_status" = 1
    AND "is_hidden" = false
    AND "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_comment_forum_topic_live_user_agg_idx"
  ON "user_comment" (
    "target_id",
    "user_id"
  )
  WHERE "target_type" = 5
    AND "deleted_at" IS NULL;
