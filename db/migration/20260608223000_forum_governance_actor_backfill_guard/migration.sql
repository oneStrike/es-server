UPDATE "forum_moderator_action_log" AS log
SET "actor_user_id" = moderator."user_id"
FROM "forum_moderator" AS moderator
WHERE log."actor_type" = 1
  AND log."moderator_id" = moderator."id";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_topic_admin_deleted_updated_idx"
  ON "forum_topic" ("updated_at" DESC, "id" DESC)
  WHERE "deleted_at" IS NOT NULL;
--> statement-breakpoint
DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT count(*)::integer
    INTO orphan_count
  FROM "forum_moderator_action_log" AS log
  WHERE log."actor_type" = 1
    AND (
      log."moderator_id" IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM "forum_moderator" AS moderator
        WHERE moderator."id" = log."moderator_id"
          AND moderator."user_id" = log."actor_user_id"
      )
    );

  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'forum_moderator_action_log has % moderator rows with invalid actor_user_id mapping',
      orphan_count;
  END IF;
END $$;
