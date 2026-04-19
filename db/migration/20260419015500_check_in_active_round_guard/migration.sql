CREATE UNIQUE INDEX IF NOT EXISTS "check_in_streak_round_config_single_active_idx"
ON "check_in_streak_round_config" ("status")
WHERE "status" = 1;
