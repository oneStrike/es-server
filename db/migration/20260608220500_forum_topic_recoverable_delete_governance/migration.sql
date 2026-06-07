ALTER TABLE "user_comment"
  ADD COLUMN IF NOT EXISTS "topic_delete_cascade_id" varchar(80);
--> statement-breakpoint
ALTER TABLE "forum_moderator_action_log"
  ADD COLUMN IF NOT EXISTS "actor_type" smallint DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "forum_moderator_action_log"
  ADD COLUMN IF NOT EXISTS "actor_user_id" integer;
--> statement-breakpoint
ALTER TABLE "forum_moderator_action_log"
  ALTER COLUMN "moderator_id" DROP NOT NULL;
--> statement-breakpoint
UPDATE "forum_moderator_action_log" AS log
SET
  "actor_type" = 1,
  "actor_user_id" = moderator."user_id"
FROM "forum_moderator" AS moderator
WHERE log."moderator_id" = moderator."id"
  AND log."actor_user_id" IS NULL;
--> statement-breakpoint
DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT count(*)::integer
    INTO orphan_count
  FROM "forum_moderator_action_log" AS log
  WHERE log."moderator_id" IS NOT NULL
    AND log."actor_user_id" IS NULL;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'forum_moderator_action_log has % rows whose moderator_id cannot map to forum_moderator.user_id',
      orphan_count;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_comment_topic_delete_cascade_id_idx"
  ON "user_comment" ("topic_delete_cascade_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_comment_forum_topic_restore_batch_idx"
  ON "user_comment" ("target_id", "topic_delete_cascade_id", "deleted_at")
  WHERE "target_type" = 5 AND "topic_delete_cascade_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_governance_action_log_actor_created_at_idx"
  ON "forum_moderator_action_log" ("actor_type", "actor_user_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_topic_admin_active_updated_idx"
  ON "forum_topic" ("updated_at" DESC, "id" DESC)
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_topic_admin_active_audit_updated_idx"
  ON "forum_topic" ("audit_status", "updated_at" DESC, "id" DESC)
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_topic_admin_active_section_updated_idx"
  ON "forum_topic" ("section_id", "updated_at" DESC, "id" DESC)
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_topic_admin_active_user_updated_idx"
  ON "forum_topic" ("user_id", "updated_at" DESC, "id" DESC)
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_topic_admin_active_created_updated_idx"
  ON "forum_topic" ("created_at", "updated_at" DESC, "id" DESC)
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_topic_admin_deleted_review_idx"
  ON "forum_topic" ("deleted_at" DESC, "updated_at" DESC, "id" DESC)
  WHERE "deleted_at" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_topic_admin_deleted_updated_idx"
  ON "forum_topic" ("updated_at" DESC, "id" DESC)
  WHERE "deleted_at" IS NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "forum_moderator_action_log"
    DROP CONSTRAINT IF EXISTS "forum_moderator_action_log_action_type_valid_chk";
  ALTER TABLE "forum_moderator_action_log"
    ADD CONSTRAINT "forum_moderator_action_log_action_type_valid_chk"
    CHECK ("action_type" IN (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16));
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "forum_moderator_action_log"
    ADD CONSTRAINT "forum_governance_action_log_actor_type_valid_chk"
    CHECK ("actor_type" IN (1,2));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "forum_moderator_action_log"
    ADD CONSTRAINT "forum_governance_action_log_actor_user_present_chk"
    CHECK ("actor_user_id" IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "forum_moderator_action_log"
    ADD CONSTRAINT "forum_governance_action_log_moderator_presence_chk"
    CHECK (
      ("actor_type" = 1 AND "moderator_id" IS NOT NULL)
      OR ("actor_type" = 2 AND "moderator_id" IS NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
