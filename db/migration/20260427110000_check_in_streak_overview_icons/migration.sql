ALTER TABLE IF EXISTS "check_in_streak_rule"
  ADD COLUMN IF NOT EXISTS "reward_overview_icon_url" varchar(500);

CREATE INDEX IF NOT EXISTS "check_in_streak_rule_reward_overview_icon_url_idx"
  ON "check_in_streak_rule" ("reward_overview_icon_url");

ALTER TABLE IF EXISTS "check_in_streak_grant"
  ADD COLUMN IF NOT EXISTS "reward_overview_icon_url" varchar(500);

CREATE INDEX IF NOT EXISTS "check_in_streak_grant_reward_overview_icon_url_idx"
  ON "check_in_streak_grant" ("reward_overview_icon_url");
