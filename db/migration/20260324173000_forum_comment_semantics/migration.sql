ALTER TABLE "forum_section"
  RENAME COLUMN "reply_count" TO "comment_count";

ALTER TABLE "forum_topic"
  DROP CONSTRAINT "forum_topic_reply_count_non_negative_chk";

UPDATE "forum_topic"
SET "comment_count" = GREATEST(
  COALESCE("comment_count", 0),
  COALESCE("reply_count", 0)
);

DROP INDEX "forum_topic_reply_count_idx";

ALTER TABLE "forum_topic"
  DROP COLUMN "reply_count";

ALTER TABLE "forum_topic"
  RENAME COLUMN "last_reply_user_id" TO "last_comment_user_id";

ALTER TABLE "forum_topic"
  RENAME COLUMN "last_reply_at" TO "last_comment_at";

ALTER INDEX "forum_topic_last_reply_at_idx"
  RENAME TO "forum_topic_last_comment_at_idx";

ALTER INDEX "forum_topic_section_id_last_reply_at_idx"
  RENAME TO "forum_topic_section_id_last_comment_at_idx";
