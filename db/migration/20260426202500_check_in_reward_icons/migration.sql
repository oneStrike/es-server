ALTER TABLE IF EXISTS "check_in_config"
  ADD COLUMN IF NOT EXISTS "makeup_icon_url" varchar(500),
  ADD COLUMN IF NOT EXISTS "reward_overview_icon_url" varchar(500);

CREATE INDEX IF NOT EXISTS "check_in_config_makeup_icon_url_idx"
  ON "check_in_config" ("makeup_icon_url");

CREATE INDEX IF NOT EXISTS "check_in_config_reward_overview_icon_url_idx"
  ON "check_in_config" ("reward_overview_icon_url");

ALTER TABLE IF EXISTS "check_in_record"
  ADD COLUMN IF NOT EXISTS "resolved_reward_overview_icon_url" varchar(500),
  ADD COLUMN IF NOT EXISTS "resolved_makeup_icon_url" varchar(500);

CREATE INDEX IF NOT EXISTS "check_in_record_reward_overview_icon_url_idx"
  ON "check_in_record" ("resolved_reward_overview_icon_url");

ALTER TABLE IF EXISTS "check_in_streak_rule_reward_item"
  ADD COLUMN IF NOT EXISTS "icon_url" varchar(500);

CREATE INDEX IF NOT EXISTS "check_in_streak_rule_reward_item_icon_url_idx"
  ON "check_in_streak_rule_reward_item" ("icon_url");

ALTER TABLE IF EXISTS "check_in_streak_grant_reward_item"
  ADD COLUMN IF NOT EXISTS "icon_url" varchar(500);

CREATE INDEX IF NOT EXISTS "check_in_streak_grant_reward_item_icon_url_idx"
  ON "check_in_streak_grant_reward_item" ("icon_url");
