ALTER TABLE "forum_moderator_action_log"
DROP CONSTRAINT IF EXISTS "forum_moderator_action_log_action_type_valid_chk";
--> statement-breakpoint
ALTER TABLE "forum_moderator_action_log"
ADD CONSTRAINT "forum_moderator_action_log_action_type_valid_chk"
CHECK ("action_type" in (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15));
