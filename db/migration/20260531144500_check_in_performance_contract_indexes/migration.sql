DROP INDEX IF EXISTS "check_in_config_makeup_icon_url_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "check_in_config_reward_overview_icon_url_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "check_in_record_reward_overview_icon_url_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "check_in_streak_rule_reward_overview_icon_url_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "check_in_streak_grant_reward_overview_icon_url_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "check_in_streak_rule_reward_item_icon_url_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "check_in_streak_grant_reward_item_icon_url_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "check_in_streak_progress_active_leaderboard_idx"
  ON "check_in_streak_progress" (
    "current_streak" DESC,
    "last_signed_date" DESC,
    "id"
  )
  WHERE "current_streak" > 0;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "check_in_streak_grant_trigger_sign_date_idx"
  ON "check_in_streak_grant" ("trigger_sign_date");
