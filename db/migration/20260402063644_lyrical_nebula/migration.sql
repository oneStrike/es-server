ALTER TABLE "check_in_cycle" ADD CONSTRAINT "check_in_cycle_version_non_negative_chk" CHECK ("version" >= 0);--> statement-breakpoint
ALTER TABLE "check_in_cycle" ADD CONSTRAINT "check_in_cycle_last_signed_date_in_cycle_chk" CHECK ("last_signed_date" is null or ("last_signed_date" >= "cycle_start_date" and "last_signed_date" <= "cycle_end_date"));--> statement-breakpoint
ALTER TABLE "check_in_cycle" ADD CONSTRAINT "check_in_cycle_current_streak_not_gt_signed_count_chk" CHECK ("current_streak" <= "signed_count");--> statement-breakpoint
ALTER TABLE "check_in_cycle" ADD CONSTRAINT "check_in_cycle_makeup_used_count_not_gt_signed_count_chk" CHECK ("makeup_used_count" <= "signed_count");--> statement-breakpoint
ALTER TABLE "check_in_cycle" ADD CONSTRAINT "check_in_cycle_signed_count_not_gt_cycle_days_chk" CHECK ("signed_count" <= ("cycle_end_date" - "cycle_start_date" + 1));--> statement-breakpoint
ALTER TABLE "check_in_plan" ADD CONSTRAINT "check_in_plan_status_valid_chk" CHECK ("status" in (0, 1, 2, 3));--> statement-breakpoint
ALTER TABLE "check_in_plan" ADD CONSTRAINT "check_in_plan_cycle_type_valid_chk" CHECK ("cycle_type" in ('daily', 'weekly', 'monthly'));--> statement-breakpoint
ALTER TABLE "check_in_record" ADD CONSTRAINT "check_in_record_record_type_valid_chk" CHECK ("record_type" in (1, 2));--> statement-breakpoint
ALTER TABLE "check_in_record" ADD CONSTRAINT "check_in_record_reward_status_valid_chk" CHECK ("reward_status" is null or "reward_status" in (0, 1, 2));--> statement-breakpoint
ALTER TABLE "check_in_record" ADD CONSTRAINT "check_in_record_reward_result_type_valid_chk" CHECK ("reward_result_type" is null or "reward_result_type" in (1, 2, 3));--> statement-breakpoint
ALTER TABLE "check_in_record" ADD CONSTRAINT "check_in_record_operator_type_valid_chk" CHECK ("operator_type" in (1, 2, 3));--> statement-breakpoint
ALTER TABLE "check_in_record" ADD CONSTRAINT "check_in_record_reward_state_consistent_chk" CHECK ((
      "reward_status" is null
      and "reward_result_type" is null
      and "reward_settled_at" is null
    ) or (
      "reward_status" = 0
      and "reward_result_type" is null
      and "reward_settled_at" is null
    ) or (
      "reward_status" = 1
      and "reward_result_type" in (1, 2)
      and "reward_settled_at" is not null
    ) or (
      "reward_status" = 2
      and "reward_result_type" = 3
      and "reward_settled_at" is not null
    ));--> statement-breakpoint
ALTER TABLE "check_in_streak_reward_grant" ADD CONSTRAINT "check_in_streak_grant_status_valid_chk" CHECK ("grant_status" in (0, 1, 2));--> statement-breakpoint
ALTER TABLE "check_in_streak_reward_grant" ADD CONSTRAINT "check_in_streak_grant_result_type_valid_chk" CHECK ("grant_result_type" is null or "grant_result_type" in (1, 2, 3));--> statement-breakpoint
ALTER TABLE "check_in_streak_reward_grant" ADD CONSTRAINT "check_in_streak_grant_state_consistent_chk" CHECK ((
      "grant_status" = 0
      and "grant_result_type" is null
      and "grant_settled_at" is null
    ) or (
      "grant_status" = 1
      and "grant_result_type" in (1, 2)
      and "grant_settled_at" is not null
    ) or (
      "grant_status" = 2
      and "grant_result_type" = 3
      and "grant_settled_at" is not null
    ));--> statement-breakpoint
ALTER TABLE "check_in_streak_reward_rule" ADD CONSTRAINT "check_in_streak_rule_status_valid_chk" CHECK ("status" in (0, 1));