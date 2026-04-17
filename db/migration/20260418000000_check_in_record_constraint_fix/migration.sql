ALTER TABLE "check_in_record"
  DROP CONSTRAINT IF EXISTS "check_in_record_reward_resolution_consistent_chk";

ALTER TABLE "check_in_record"
  ADD CONSTRAINT "check_in_record_reward_resolution_consistent_chk"
  CHECK ((
    "resolved_reward_items" is null
    and "resolved_reward_source_type" is null
    and "resolved_reward_rule_key" is null
  ) or (
    "resolved_reward_items" is not null
    and "resolved_reward_source_type" in (1, 2, 3)
  ));
