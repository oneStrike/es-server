UPDATE "forum_user_action_log"
SET
  "action_type" = 2,
  "target_type" = 2
WHERE
  "action_type" = 3
  AND "target_type" = 3
  AND "user_agent" = 'seed-script/comment';
--> statement-breakpoint
ALTER TABLE "forum_user_action_log"
DROP CONSTRAINT IF EXISTS "forum_user_action_log_action_type_valid_chk";
--> statement-breakpoint
ALTER TABLE "forum_user_action_log"
ADD CONSTRAINT "forum_user_action_log_action_type_valid_chk"
CHECK ("action_type" in (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12));
--> statement-breakpoint
ALTER TABLE "forum_user_action_log"
DROP CONSTRAINT IF EXISTS "forum_user_action_log_target_type_valid_chk";
--> statement-breakpoint
ALTER TABLE "forum_user_action_log"
ADD CONSTRAINT "forum_user_action_log_target_type_valid_chk"
CHECK ("target_type" in (1, 2));
