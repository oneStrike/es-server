DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "user_asset_balance"
    WHERE
      ("asset_type" IN (1, 2) AND btrim("asset_key") <> '')
      OR ("asset_type" IN (3, 4, 5) AND btrim("asset_key") = '')
  ) THEN
    RAISE EXCEPTION 'user_asset_balance contains asset_type/asset_key values that violate the asset key contract';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "user_asset_balance" DROP CONSTRAINT IF EXISTS "user_asset_balance_asset_key_not_blank_chk";
--> statement-breakpoint
ALTER TABLE "user_asset_balance" ADD CONSTRAINT "user_asset_balance_asset_key_not_blank_chk"
CHECK (
  ("asset_type" IN (1, 2) AND btrim("asset_key") = '')
  OR ("asset_type" IN (3, 4, 5) AND btrim("asset_key") <> '')
);
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "user_favorite"
    WHERE "target_type" NOT IN (1, 2, 3)
  ) THEN
    RAISE EXCEPTION 'user_favorite contains target_type values outside (1, 2, 3)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "user_like"
    WHERE
      "target_type" NOT IN (1, 2, 3, 4, 5, 6)
      OR "scene_type" NOT IN (1, 2, 3, 10, 11, 12)
      OR ("comment_level" IS NOT NULL AND "comment_level" NOT IN (1, 2))
  ) THEN
    RAISE EXCEPTION 'user_like contains values that violate target_type/scene_type/comment_level checks';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "user_report"
    WHERE
      "target_type" NOT IN (1, 2, 3, 4, 5, 6, 7)
      OR "scene_type" NOT IN (1, 2, 3, 10, 11, 12)
      OR ("comment_level" IS NOT NULL AND "comment_level" NOT IN (1, 2))
      OR "reason_type" NOT IN (1, 2, 3, 4, 99)
      OR "status" NOT IN (1, 2, 3, 4)
  ) THEN
    RAISE EXCEPTION 'user_report contains values that violate target_type/scene_type/comment_level/reason_type/status checks';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "chat_message"
    WHERE
      "message_type" NOT IN (1, 2, 3)
      OR "status" NOT IN (1, 2, 3)
  ) THEN
    RAISE EXCEPTION 'chat_message contains values that violate message_type/status checks';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "chat_conversation_member"
    WHERE "role" NOT IN (1, 2)
  ) THEN
    RAISE EXCEPTION 'chat_conversation_member contains role values outside (1, 2)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "user_badge"
    WHERE "type" NOT IN (1, 2, 3) OR "sort_order" < 0
  ) THEN
    RAISE EXCEPTION 'user_badge contains values that violate type/sort_order checks';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "user_level_rule"
    WHERE
      "required_experience" < 0
      OR "login_days" < 0
      OR "sort_order" < 0
      OR "daily_topic_limit" < 0
      OR "daily_reply_comment_limit" < 0
      OR "post_interval" < 0
      OR "daily_like_limit" < 0
      OR "daily_favorite_limit" < 0
      OR "blacklist_limit" < 0
      OR "work_collection_limit" < 0
      OR "purchase_payable_rate" < 0
      OR "purchase_payable_rate" > 1
  ) THEN
    RAISE EXCEPTION 'user_level_rule contains values that violate non-negative or payable-rate checks';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "user_browse_log"
    WHERE "target_type" NOT IN (1, 2, 3, 4, 5)
  ) THEN
    RAISE EXCEPTION 'user_browse_log contains target_type values outside (1, 2, 3, 4, 5)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "user_download_record"
    WHERE "target_type" NOT IN (1, 2)
  ) THEN
    RAISE EXCEPTION 'user_download_record contains target_type values outside (1, 2)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "user_purchase_record"
    WHERE
      "target_type" NOT IN (1, 2)
      OR "status" NOT IN (1, 2, 3, 4)
      OR "payment_method" NOT IN (1, 2, 3, 4)
      OR "original_price" < 0
      OR "paid_price" < 0
      OR "payable_rate" < 0
      OR "payable_rate" > 1
  ) THEN
    RAISE EXCEPTION 'user_purchase_record contains values that violate target/status/payment/price/rate checks';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "user_work_reading_state"
    WHERE "work_type" NOT IN (1, 2)
  ) THEN
    RAISE EXCEPTION 'user_work_reading_state contains work_type values outside (1, 2)';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "user_favorite" ADD CONSTRAINT "user_favorite_target_type_valid_chk"
CHECK ("target_type" IN (1, 2, 3));
--> statement-breakpoint
ALTER TABLE "user_like" ADD CONSTRAINT "user_like_target_type_valid_chk"
CHECK ("target_type" IN (1, 2, 3, 4, 5, 6));
--> statement-breakpoint
ALTER TABLE "user_like" ADD CONSTRAINT "user_like_scene_type_valid_chk"
CHECK ("scene_type" IN (1, 2, 3, 10, 11, 12));
--> statement-breakpoint
ALTER TABLE "user_like" ADD CONSTRAINT "user_like_comment_level_valid_chk"
CHECK ("comment_level" IS NULL OR "comment_level" IN (1, 2));
--> statement-breakpoint
ALTER TABLE "user_report" ADD CONSTRAINT "user_report_target_type_valid_chk"
CHECK ("target_type" IN (1, 2, 3, 4, 5, 6, 7));
--> statement-breakpoint
ALTER TABLE "user_report" ADD CONSTRAINT "user_report_scene_type_valid_chk"
CHECK ("scene_type" IN (1, 2, 3, 10, 11, 12));
--> statement-breakpoint
ALTER TABLE "user_report" ADD CONSTRAINT "user_report_comment_level_valid_chk"
CHECK ("comment_level" IS NULL OR "comment_level" IN (1, 2));
--> statement-breakpoint
ALTER TABLE "user_report" ADD CONSTRAINT "user_report_reason_type_valid_chk"
CHECK ("reason_type" IN (1, 2, 3, 4, 99));
--> statement-breakpoint
ALTER TABLE "user_report" ADD CONSTRAINT "user_report_status_valid_chk"
CHECK ("status" IN (1, 2, 3, 4));
--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_message_type_valid_chk"
CHECK ("message_type" IN (1, 2, 3));
--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_status_valid_chk"
CHECK ("status" IN (1, 2, 3));
--> statement-breakpoint
ALTER TABLE "chat_conversation_member" ADD CONSTRAINT "chat_conversation_member_role_valid_chk"
CHECK ("role" IN (1, 2));
--> statement-breakpoint
ALTER TABLE "user_badge" ADD CONSTRAINT "user_badge_type_valid_chk"
CHECK ("type" IN (1, 2, 3));
--> statement-breakpoint
ALTER TABLE "user_badge" ADD CONSTRAINT "user_badge_sort_order_non_negative_chk"
CHECK ("sort_order" >= 0);
--> statement-breakpoint
ALTER TABLE "user_level_rule" ADD CONSTRAINT "user_level_rule_required_experience_non_negative_chk"
CHECK ("required_experience" >= 0);
--> statement-breakpoint
ALTER TABLE "user_level_rule" ADD CONSTRAINT "user_level_rule_login_days_non_negative_chk"
CHECK ("login_days" >= 0);
--> statement-breakpoint
ALTER TABLE "user_level_rule" ADD CONSTRAINT "user_level_rule_sort_order_non_negative_chk"
CHECK ("sort_order" >= 0);
--> statement-breakpoint
ALTER TABLE "user_level_rule" ADD CONSTRAINT "user_level_rule_daily_topic_limit_non_negative_chk"
CHECK ("daily_topic_limit" >= 0);
--> statement-breakpoint
ALTER TABLE "user_level_rule" ADD CONSTRAINT "user_level_rule_daily_reply_comment_limit_non_negative_chk"
CHECK ("daily_reply_comment_limit" >= 0);
--> statement-breakpoint
ALTER TABLE "user_level_rule" ADD CONSTRAINT "user_level_rule_post_interval_non_negative_chk"
CHECK ("post_interval" >= 0);
--> statement-breakpoint
ALTER TABLE "user_level_rule" ADD CONSTRAINT "user_level_rule_daily_like_limit_non_negative_chk"
CHECK ("daily_like_limit" >= 0);
--> statement-breakpoint
ALTER TABLE "user_level_rule" ADD CONSTRAINT "user_level_rule_daily_favorite_limit_non_negative_chk"
CHECK ("daily_favorite_limit" >= 0);
--> statement-breakpoint
ALTER TABLE "user_level_rule" ADD CONSTRAINT "user_level_rule_blacklist_limit_non_negative_chk"
CHECK ("blacklist_limit" >= 0);
--> statement-breakpoint
ALTER TABLE "user_level_rule" ADD CONSTRAINT "user_level_rule_work_collection_limit_non_negative_chk"
CHECK ("work_collection_limit" >= 0);
--> statement-breakpoint
ALTER TABLE "user_level_rule" ADD CONSTRAINT "user_level_rule_purchase_payable_rate_range_chk"
CHECK ("purchase_payable_rate" >= 0 AND "purchase_payable_rate" <= 1);
--> statement-breakpoint
ALTER TABLE "user_browse_log" ADD CONSTRAINT "user_browse_log_target_type_valid_chk"
CHECK ("target_type" IN (1, 2, 3, 4, 5));
--> statement-breakpoint
ALTER TABLE "user_download_record" ADD CONSTRAINT "user_download_record_target_type_valid_chk"
CHECK ("target_type" IN (1, 2));
--> statement-breakpoint
ALTER TABLE "user_purchase_record" ADD CONSTRAINT "user_purchase_record_target_type_valid_chk"
CHECK ("target_type" IN (1, 2));
--> statement-breakpoint
ALTER TABLE "user_purchase_record" ADD CONSTRAINT "user_purchase_record_status_valid_chk"
CHECK ("status" IN (1, 2, 3, 4));
--> statement-breakpoint
ALTER TABLE "user_purchase_record" ADD CONSTRAINT "user_purchase_record_payment_method_valid_chk"
CHECK ("payment_method" IN (1, 2, 3, 4));
--> statement-breakpoint
ALTER TABLE "user_purchase_record" ADD CONSTRAINT "user_purchase_record_original_price_non_negative_chk"
CHECK ("original_price" >= 0);
--> statement-breakpoint
ALTER TABLE "user_purchase_record" ADD CONSTRAINT "user_purchase_record_paid_price_non_negative_chk"
CHECK ("paid_price" >= 0);
--> statement-breakpoint
ALTER TABLE "user_purchase_record" ADD CONSTRAINT "user_purchase_record_payable_rate_range_chk"
CHECK ("payable_rate" >= 0 AND "payable_rate" <= 1);
--> statement-breakpoint
ALTER TABLE "user_work_reading_state" ADD CONSTRAINT "user_work_reading_state_work_type_valid_chk"
CHECK ("work_type" IN (1, 2));
