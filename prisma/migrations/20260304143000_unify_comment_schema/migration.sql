ALTER TABLE "work"
ADD COLUMN "comment_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "forum_topic"
ADD COLUMN "comment_count" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "work_comment_count_idx" ON "work"("comment_count");
CREATE INDEX "forum_topic_comment_count_idx" ON "forum_topic"("comment_count");

CREATE INDEX "user_comment_target_type_target_id_audit_status_is_hidden_deleted_at_idx"
ON "user_comment"("target_type", "target_id", "audit_status", "is_hidden", "deleted_at");

CREATE INDEX "user_comment_target_type_target_id_deleted_at_created_at_idx"
ON "user_comment"("target_type", "target_id", "deleted_at", "created_at");

UPDATE "work" w
SET "comment_count" = COALESCE(c.cnt, 0)
FROM (
  SELECT "target_id", COUNT(*)::INTEGER AS cnt
  FROM "user_comment"
  WHERE "target_type" IN (1, 2)
    AND "audit_status" = 1
    AND "is_hidden" = FALSE
    AND "deleted_at" IS NULL
  GROUP BY "target_id"
) c
WHERE w."id" = c."target_id";

UPDATE "work_chapter" wc
SET "comment_count" = COALESCE(c.cnt, 0)
FROM (
  SELECT "target_id", COUNT(*)::INTEGER AS cnt
  FROM "user_comment"
  WHERE "target_type" IN (3, 4)
    AND "audit_status" = 1
    AND "is_hidden" = FALSE
    AND "deleted_at" IS NULL
  GROUP BY "target_id"
) c
WHERE wc."id" = c."target_id";

UPDATE "forum_topic" ft
SET "comment_count" = COALESCE(c.cnt, 0)
FROM (
  SELECT "target_id", COUNT(*)::INTEGER AS cnt
  FROM "user_comment"
  WHERE "target_type" = 5
    AND "audit_status" = 1
    AND "is_hidden" = FALSE
    AND "deleted_at" IS NULL
  GROUP BY "target_id"
) c
WHERE ft."id" = c."target_id";
