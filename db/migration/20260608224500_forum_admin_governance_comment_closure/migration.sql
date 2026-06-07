DO $$
BEGIN
  ALTER TABLE "forum_moderator_action_log"
    DROP CONSTRAINT IF EXISTS "forum_moderator_action_log_action_type_valid_chk";
  ALTER TABLE "forum_moderator_action_log"
    ADD CONSTRAINT "forum_moderator_action_log_action_type_valid_chk"
    CHECK ("action_type" IN (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17));
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_comment_admin_live_created_id_idx"
  ON "user_comment" ("created_at" DESC, "id" DESC)
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_comment_admin_live_user_created_id_idx"
  ON "user_comment" ("user_id", "created_at" DESC, "id" DESC)
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_comment_admin_live_audit_created_id_idx"
  ON "user_comment" ("audit_status", "created_at" DESC, "id" DESC)
  WHERE "deleted_at" IS NULL;
