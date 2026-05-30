# Forum topic performance indexes

This migration mirrors the forum topic performance indexes declared in schema.

## Default path

`db/migrate.ts` uses Drizzle's node-postgres migrator, which runs pending migrations inside a transaction. The checked-in `migration.sql` therefore uses normal `CREATE INDEX IF NOT EXISTS` statements and is suitable for a maintenance window.

## Large table online path

For large production tables, run the same indexes manually with `CONCURRENTLY` outside Drizzle migration transaction, then mark or apply this migration during a window where no index DDL remains to execute.

Use a dedicated database session:

```sql
SET lock_timeout = '5s';
SET statement_timeout = '30min';

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "forum_topic_visible_default_feed_idx"
  ON "forum_topic" ("section_id", "is_pinned" DESC, "last_comment_at" DESC, "created_at" DESC, "id" DESC)
  WHERE "deleted_at" IS NULL AND "audit_status" = 1 AND "is_hidden" = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "forum_topic_visible_hot_feed_idx"
  ON "forum_topic" ("section_id", "comment_count" DESC, "like_count" DESC, "view_count" DESC, "created_at" DESC, "id" DESC)
  WHERE "deleted_at" IS NULL AND "audit_status" = 1 AND "is_hidden" = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "forum_topic_section_visible_activity_idx"
  ON "forum_topic" ("section_id", (coalesce("last_comment_at", "created_at")) DESC, "id" DESC)
  WHERE "deleted_at" IS NULL AND "audit_status" = 1 AND "is_hidden" = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "forum_topic_title_trgm_idx"
  ON "forum_topic" USING gin ("title" gin_trgm_ops)
  WHERE "deleted_at" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "forum_topic_content_trgm_idx"
  ON "forum_topic" USING gin ("content" gin_trgm_ops)
  WHERE "deleted_at" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "forum_hashtag_ref_visible_topic_feed_idx"
  ON "forum_hashtag_reference" ("hashtag_id", "section_id", "topic_id")
  WHERE "source_type" = 1 AND "is_source_visible" = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "forum_hashtag_ref_comment_topic_cleanup_idx"
  ON "forum_hashtag_reference" ("topic_id", "source_id")
  WHERE "source_type" = 2;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "user_comment_forum_topic_visible_latest_idx"
  ON "user_comment" ("target_id", "created_at" DESC, "id" DESC)
  WHERE "target_type" = 5 AND "audit_status" = 1 AND "is_hidden" = false AND "deleted_at" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "user_comment_forum_topic_live_user_agg_idx"
  ON "user_comment" ("target_id", "user_id")
  WHERE "target_type" = 5 AND "deleted_at" IS NULL;
```

If a concurrent index build fails, PostgreSQL may leave an invalid index. Inspect and clean it before retrying:

```sql
SELECT indexrelid::regclass AS index_name, indisvalid, indisready
FROM pg_index
WHERE indexrelid::regclass::text IN (
  'forum_topic_visible_default_feed_idx',
  'forum_topic_visible_hot_feed_idx',
  'forum_topic_section_visible_activity_idx',
  'forum_topic_title_trgm_idx',
  'forum_topic_content_trgm_idx',
  'forum_hashtag_ref_visible_topic_feed_idx',
  'forum_hashtag_ref_comment_topic_cleanup_idx',
  'user_comment_forum_topic_visible_latest_idx',
  'user_comment_forum_topic_live_user_agg_idx'
);

DROP INDEX CONCURRENTLY IF EXISTS "index_name_here";
```

## Query mapping

- `forum_topic_visible_default_feed_idx`: public/default/following topic feed visible filter plus `isPinned, lastCommentAt, createdAt`.
- `forum_topic_visible_hot_feed_idx`: public hot feed visible filter plus `commentCount, likeCount, viewCount, createdAt`.
- `forum_topic_section_visible_activity_idx`: `ForumCounterService.syncSectionVisibleState`.
- `forum_topic_title_trgm_idx` and `forum_topic_content_trgm_idx`: admin `%keyword%` `ILIKE` list/count.
- `forum_hashtag_ref_visible_topic_feed_idx`: following hashtag feed `exists` condition.
- `forum_hashtag_ref_comment_topic_cleanup_idx`: deleting comment hashtag facts by topic.
- `user_comment_forum_topic_visible_latest_idx`: `ForumCounterService.syncTopicCommentState`.
- `user_comment_forum_topic_live_user_agg_idx`: deleting a topic with SQL-side user comment aggregation.
