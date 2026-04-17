DELETE FROM "growth_reward_rule"
WHERE "delta" <= 0;

ALTER TABLE "growth_reward_rule"
  DROP CONSTRAINT IF EXISTS "growth_reward_rule_delta_non_zero_chk";

ALTER TABLE "growth_reward_rule"
  DROP CONSTRAINT IF EXISTS "growth_reward_rule_delta_positive_chk";

ALTER TABLE "growth_reward_rule"
  ADD CONSTRAINT "growth_reward_rule_delta_positive_chk"
  CHECK ("delta" > 0);
