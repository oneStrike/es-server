BEGIN;
ALTER TABLE "user_badge" RENAME TO "app_badge";
--> statement-breakpoint
ALTER TABLE "user_badge_assignment" RENAME TO "app_user_badge_assignment";
--> statement-breakpoint
ALTER TABLE "user_browse_log" RENAME TO "app_user_browse_log";
--> statement-breakpoint
ALTER TABLE "user_comment" RENAME TO "app_user_comment";
--> statement-breakpoint
ALTER TABLE "user_download_record" RENAME TO "app_user_download_record";
--> statement-breakpoint
ALTER TABLE "user_experience_rule" RENAME TO "app_user_experience_rule";
--> statement-breakpoint
ALTER TABLE "user_favorite" RENAME TO "app_user_favorite";
--> statement-breakpoint
ALTER TABLE "user_follow" RENAME TO "app_user_follow";
--> statement-breakpoint
ALTER TABLE "user_level_rule" RENAME TO "app_user_level_rule";
--> statement-breakpoint
ALTER TABLE "user_like" RENAME TO "app_user_like";
--> statement-breakpoint
ALTER TABLE "user_point_rule" RENAME TO "app_user_point_rule";
--> statement-breakpoint
ALTER TABLE "user_purchase_record" RENAME TO "app_user_purchase_record";
--> statement-breakpoint
ALTER TABLE "user_report" RENAME TO "app_user_report";
--> statement-breakpoint
ALTER TABLE "user_work_reading_state" RENAME TO "app_user_work_reading_state";
--> statement-breakpoint
ALTER TABLE "forum_moderator_section" RENAME TO "forum_moderator_section_relation";
--> statement-breakpoint
ALTER TABLE "forum_topic_tag" RENAME TO "forum_topic_tag_relation";
--> statement-breakpoint
ALTER TABLE "notification_preference" RENAME TO "app_user_notification_preference";
--> statement-breakpoint
ALTER TABLE "user_notification" RENAME TO "app_user_notification";
--> statement-breakpoint
ALTER TABLE "sys_config" RENAME TO "system_config";
--> statement-breakpoint
ALTER TABLE "sys_dictionary" RENAME TO "system_dictionary";
--> statement-breakpoint
ALTER TABLE "sys_dictionary_item" RENAME TO "system_dictionary_item";
--> statement-breakpoint
ALTER TABLE "sys_request_log" RENAME TO "system_request_log";
--> statement-breakpoint
ALTER TABLE "sensitive_word" RENAME TO "system_sensitive_word";
--> statement-breakpoint
ALTER SEQUENCE "user_badge_id_seq" RENAME TO "app_badge_id_seq";
--> statement-breakpoint
ALTER SEQUENCE "user_browse_log_id_seq" RENAME TO "app_user_browse_log_id_seq";
--> statement-breakpoint
ALTER SEQUENCE "user_comment_id_seq" RENAME TO "app_user_comment_id_seq";
--> statement-breakpoint
ALTER SEQUENCE "user_download_record_id_seq" RENAME TO "app_user_download_record_id_seq";
--> statement-breakpoint
ALTER SEQUENCE "user_experience_rule_id_seq" RENAME TO "app_user_experience_rule_id_seq";
--> statement-breakpoint
ALTER SEQUENCE "user_favorite_id_seq" RENAME TO "app_user_favorite_id_seq";
--> statement-breakpoint
ALTER SEQUENCE "user_follow_id_seq" RENAME TO "app_user_follow_id_seq";
--> statement-breakpoint
ALTER SEQUENCE "user_level_rule_id_seq" RENAME TO "app_user_level_rule_id_seq";
--> statement-breakpoint
ALTER SEQUENCE "user_like_id_seq" RENAME TO "app_user_like_id_seq";
--> statement-breakpoint
ALTER SEQUENCE "user_point_rule_id_seq" RENAME TO "app_user_point_rule_id_seq";
--> statement-breakpoint
ALTER SEQUENCE "user_purchase_record_id_seq" RENAME TO "app_user_purchase_record_id_seq";
--> statement-breakpoint
ALTER SEQUENCE "user_report_id_seq" RENAME TO "app_user_report_id_seq";
--> statement-breakpoint
ALTER SEQUENCE "notification_preference_id_seq" RENAME TO "app_user_notification_preference_id_seq";
--> statement-breakpoint
ALTER SEQUENCE "user_notification_id_seq" RENAME TO "app_user_notification_id_seq";
--> statement-breakpoint
ALTER SEQUENCE "sys_config_id_seq" RENAME TO "system_config_id_seq";
--> statement-breakpoint
ALTER SEQUENCE "sys_dictionary_id_seq" RENAME TO "system_dictionary_id_seq";
--> statement-breakpoint
ALTER SEQUENCE "sys_dictionary_item_id_seq" RENAME TO "system_dictionary_item_id_seq";
--> statement-breakpoint
ALTER SEQUENCE "sys_request_log_id_seq" RENAME TO "system_request_log_id_seq";
--> statement-breakpoint
ALTER SEQUENCE "sensitive_word_id_seq" RENAME TO "system_sensitive_word_id_seq";
--> statement-breakpoint
ALTER TABLE "app_badge" RENAME CONSTRAINT "user_badge_pkey" TO "app_badge_pkey";
--> statement-breakpoint
ALTER TABLE "app_user_badge_assignment" RENAME CONSTRAINT "user_badge_assignment_pkey" TO "app_user_badge_assignment_pkey";
--> statement-breakpoint
ALTER TABLE "app_user_browse_log" RENAME CONSTRAINT "user_browse_log_pkey" TO "app_user_browse_log_pkey";
--> statement-breakpoint
ALTER TABLE "app_user_comment" RENAME CONSTRAINT "user_comment_pkey" TO "app_user_comment_pkey";
--> statement-breakpoint
ALTER TABLE "app_user_download_record" RENAME CONSTRAINT "user_download_record_pkey" TO "app_user_download_record_pkey";
--> statement-breakpoint
ALTER TABLE "app_user_download_record" RENAME CONSTRAINT "user_download_record_target_type_target_id_user_id_key" TO "app_user_download_record_target_type_target_id_user_id_key";
--> statement-breakpoint
ALTER TABLE "app_user_experience_rule" RENAME CONSTRAINT "user_experience_rule_pkey" TO "app_user_experience_rule_pkey";
--> statement-breakpoint
ALTER TABLE "app_user_experience_rule" RENAME CONSTRAINT "user_experience_rule_type_key" TO "app_user_experience_rule_type_key";
--> statement-breakpoint
ALTER TABLE "app_user_favorite" RENAME CONSTRAINT "user_favorite_pkey" TO "app_user_favorite_pkey";
--> statement-breakpoint
ALTER TABLE "app_user_favorite" RENAME CONSTRAINT "user_favorite_target_type_target_id_user_id_key" TO "app_user_favorite_target_type_target_id_user_id_key";
--> statement-breakpoint
ALTER TABLE "app_user_follow" RENAME CONSTRAINT "user_follow_pkey" TO "app_user_follow_pkey";
--> statement-breakpoint
ALTER TABLE "app_user_follow" RENAME CONSTRAINT "user_follow_target_type_target_id_user_id_key" TO "app_user_follow_target_type_target_id_user_id_key";
--> statement-breakpoint
ALTER TABLE "app_user_level_rule" RENAME CONSTRAINT "user_level_rule_pkey" TO "app_user_level_rule_pkey";
--> statement-breakpoint
ALTER TABLE "app_user_level_rule" RENAME CONSTRAINT "user_level_rule_name_key" TO "app_user_level_rule_name_key";
--> statement-breakpoint
ALTER TABLE "app_user_like" RENAME CONSTRAINT "user_like_pkey" TO "app_user_like_pkey";
--> statement-breakpoint
ALTER TABLE "app_user_like" RENAME CONSTRAINT "user_like_target_type_target_id_user_id_key" TO "app_user_like_target_type_target_id_user_id_key";
--> statement-breakpoint
ALTER TABLE "app_user_point_rule" RENAME CONSTRAINT "user_point_rule_pkey" TO "app_user_point_rule_pkey";
--> statement-breakpoint
ALTER TABLE "app_user_point_rule" RENAME CONSTRAINT "user_point_rule_type_key" TO "app_user_point_rule_type_key";
--> statement-breakpoint
ALTER TABLE "app_user_purchase_record" RENAME CONSTRAINT "user_purchase_record_pkey" TO "app_user_purchase_record_pkey";
--> statement-breakpoint
ALTER TABLE "app_user_report" RENAME CONSTRAINT "user_report_pkey" TO "app_user_report_pkey";
--> statement-breakpoint
ALTER TABLE "app_user_report" RENAME CONSTRAINT "user_report_reporter_id_target_type_target_id_key" TO "app_user_report_reporter_id_target_type_target_id_key";
--> statement-breakpoint
ALTER TABLE "app_user_work_reading_state" RENAME CONSTRAINT "user_work_reading_state_pkey" TO "app_user_work_reading_state_pkey";
--> statement-breakpoint
ALTER TABLE "forum_moderator_section_relation" RENAME CONSTRAINT "forum_moderator_section_pkey" TO "forum_moderator_section_relation_pkey";
--> statement-breakpoint
ALTER TABLE "forum_topic_tag_relation" RENAME CONSTRAINT "forum_topic_tag_pkey" TO "forum_topic_tag_relation_pkey";
--> statement-breakpoint
ALTER TABLE "app_user_notification_preference" RENAME CONSTRAINT "notification_preference_pkey" TO "app_user_notification_preference_pkey";
--> statement-breakpoint
ALTER TABLE "app_user_notification_preference" RENAME CONSTRAINT "notification_preference_user_id_notification_type_key" TO "app_user_notification_preference_user_id_notification_type_key";
--> statement-breakpoint
ALTER TABLE "app_user_notification" RENAME CONSTRAINT "user_notification_pkey" TO "app_user_notification_pkey";
--> statement-breakpoint
ALTER TABLE "app_user_notification" RENAME CONSTRAINT "user_notification_user_id_biz_key_key" TO "app_user_notification_user_id_biz_key_key";
--> statement-breakpoint
ALTER TABLE "system_config" RENAME CONSTRAINT "sys_config_pkey" TO "system_config_pkey";
--> statement-breakpoint
ALTER TABLE "system_dictionary" RENAME CONSTRAINT "sys_dictionary_pkey" TO "system_dictionary_pkey";
--> statement-breakpoint
ALTER TABLE "system_dictionary" RENAME CONSTRAINT "sys_dictionary_name_key" TO "system_dictionary_name_key";
--> statement-breakpoint
ALTER TABLE "system_dictionary" RENAME CONSTRAINT "sys_dictionary_code_key" TO "system_dictionary_code_key";
--> statement-breakpoint
ALTER TABLE "system_dictionary_item" RENAME CONSTRAINT "sys_dictionary_item_pkey" TO "system_dictionary_item_pkey";
--> statement-breakpoint
ALTER TABLE "system_dictionary_item" RENAME CONSTRAINT "sys_dictionary_item_dictionary_code_code_key" TO "system_dictionary_item_dictionary_code_code_key";
--> statement-breakpoint
ALTER TABLE "system_request_log" RENAME CONSTRAINT "sys_request_log_pkey" TO "system_request_log_pkey";
--> statement-breakpoint
ALTER TABLE "system_sensitive_word" RENAME CONSTRAINT "sensitive_word_pkey" TO "system_sensitive_word_pkey";
--> statement-breakpoint
ALTER TABLE "system_sensitive_word" RENAME CONSTRAINT "sensitive_word_word_key" TO "system_sensitive_word_word_key";
--> statement-breakpoint
ALTER INDEX "user_badge_type_idx" RENAME TO "app_badge_type_idx";
--> statement-breakpoint
ALTER INDEX "user_badge_business_event_key_idx" RENAME TO "app_badge_business_event_key_idx";
--> statement-breakpoint
ALTER INDEX "user_badge_sort_order_idx" RENAME TO "app_badge_sort_order_idx";
--> statement-breakpoint
ALTER INDEX "user_badge_is_enabled_idx" RENAME TO "app_badge_is_enabled_idx";
--> statement-breakpoint
ALTER INDEX "user_badge_created_at_idx" RENAME TO "app_badge_created_at_idx";
--> statement-breakpoint
ALTER INDEX "user_badge_assignment_badge_id_created_at_idx" RENAME TO "app_user_badge_assignment_badge_id_created_at_idx";
--> statement-breakpoint
ALTER INDEX "user_badge_assignment_user_id_created_at_idx" RENAME TO "app_user_badge_assignment_user_id_created_at_idx";
--> statement-breakpoint
ALTER INDEX "user_browse_log_target_type_target_id_idx" RENAME TO "app_user_browse_log_target_type_target_id_idx";
--> statement-breakpoint
ALTER INDEX "user_browse_log_user_id_idx" RENAME TO "app_user_browse_log_user_id_idx";
--> statement-breakpoint
ALTER INDEX "user_browse_log_viewed_at_idx" RENAME TO "app_user_browse_log_viewed_at_idx";
--> statement-breakpoint
ALTER INDEX "user_browse_log_target_type_target_id_user_id_idx" RENAME TO "app_user_browse_log_target_type_target_id_user_id_idx";
--> statement-breakpoint
ALTER INDEX "user_browse_log_user_id_viewed_at_idx" RENAME TO "app_user_browse_log_user_id_viewed_at_idx";
--> statement-breakpoint
ALTER INDEX "user_comment_target_type_target_id_created_at_idx" RENAME TO "app_user_comment_target_type_target_id_created_at_idx";
--> statement-breakpoint
ALTER INDEX "user_comment_target_type_target_id_reply_to_id_floor_idx" RENAME TO "app_user_comment_target_type_target_id_reply_to_id_floor_idx";
--> statement-breakpoint
ALTER INDEX "user_comment_target_type_target_id_audit_status_is_hidden_d_idx" RENAME TO "app_user_comment_target_type_target_id_audit_status_is_hidden_d_idx";
--> statement-breakpoint
ALTER INDEX "user_comment_actual_reply_to_id_audit_status_is_hidden_dele_idx" RENAME TO "app_user_comment_actual_reply_to_id_audit_status_is_hidden_dele_idx";
--> statement-breakpoint
ALTER INDEX "user_comment_target_type_target_id_deleted_at_created_at_idx" RENAME TO "app_user_comment_target_type_target_id_deleted_at_created_at_idx";
--> statement-breakpoint
ALTER INDEX "user_comment_user_id_idx" RENAME TO "app_user_comment_user_id_idx";
--> statement-breakpoint
ALTER INDEX "user_comment_created_at_idx" RENAME TO "app_user_comment_created_at_idx";
--> statement-breakpoint
ALTER INDEX "user_comment_audit_status_idx" RENAME TO "app_user_comment_audit_status_idx";
--> statement-breakpoint
ALTER INDEX "user_comment_is_hidden_idx" RENAME TO "app_user_comment_is_hidden_idx";
--> statement-breakpoint
ALTER INDEX "user_comment_reply_to_id_idx" RENAME TO "app_user_comment_reply_to_id_idx";
--> statement-breakpoint
ALTER INDEX "user_comment_actual_reply_to_id_idx" RENAME TO "app_user_comment_actual_reply_to_id_idx";
--> statement-breakpoint
ALTER INDEX "user_comment_deleted_at_idx" RENAME TO "app_user_comment_deleted_at_idx";
--> statement-breakpoint
ALTER INDEX "user_download_record_target_type_target_id_idx" RENAME TO "app_user_download_record_target_type_target_id_idx";
--> statement-breakpoint
ALTER INDEX "user_download_record_user_id_idx" RENAME TO "app_user_download_record_user_id_idx";
--> statement-breakpoint
ALTER INDEX "user_download_record_created_at_idx" RENAME TO "app_user_download_record_created_at_idx";
--> statement-breakpoint
ALTER INDEX "user_experience_rule_type_idx" RENAME TO "app_user_experience_rule_type_idx";
--> statement-breakpoint
ALTER INDEX "user_experience_rule_is_enabled_idx" RENAME TO "app_user_experience_rule_is_enabled_idx";
--> statement-breakpoint
ALTER INDEX "user_experience_rule_created_at_idx" RENAME TO "app_user_experience_rule_created_at_idx";
--> statement-breakpoint
ALTER INDEX "user_favorite_target_type_target_id_idx" RENAME TO "app_user_favorite_target_type_target_id_idx";
--> statement-breakpoint
ALTER INDEX "user_favorite_user_id_idx" RENAME TO "app_user_favorite_user_id_idx";
--> statement-breakpoint
ALTER INDEX "user_favorite_created_at_idx" RENAME TO "app_user_favorite_created_at_idx";
--> statement-breakpoint
ALTER INDEX "user_follow_user_id_target_type_created_at_idx" RENAME TO "app_user_follow_user_id_target_type_created_at_idx";
--> statement-breakpoint
ALTER INDEX "user_follow_target_type_target_id_created_at_idx" RENAME TO "app_user_follow_target_type_target_id_created_at_idx";
--> statement-breakpoint
ALTER INDEX "user_follow_target_type_target_id_idx" RENAME TO "app_user_follow_target_type_target_id_idx";
--> statement-breakpoint
ALTER INDEX "user_level_rule_is_enabled_sort_order_idx" RENAME TO "app_user_level_rule_is_enabled_sort_order_idx";
--> statement-breakpoint
ALTER INDEX "user_like_target_type_target_id_idx" RENAME TO "app_user_like_target_type_target_id_idx";
--> statement-breakpoint
ALTER INDEX "user_like_scene_type_scene_id_idx" RENAME TO "app_user_like_scene_type_scene_id_idx";
--> statement-breakpoint
ALTER INDEX "user_like_user_id_scene_type_created_at_idx" RENAME TO "app_user_like_user_id_scene_type_created_at_idx";
--> statement-breakpoint
ALTER INDEX "user_like_created_at_idx" RENAME TO "app_user_like_created_at_idx";
--> statement-breakpoint
ALTER INDEX "user_point_rule_type_idx" RENAME TO "app_user_point_rule_type_idx";
--> statement-breakpoint
ALTER INDEX "user_point_rule_is_enabled_idx" RENAME TO "app_user_point_rule_is_enabled_idx";
--> statement-breakpoint
ALTER INDEX "user_point_rule_created_at_idx" RENAME TO "app_user_point_rule_created_at_idx";
--> statement-breakpoint
ALTER INDEX "user_purchase_record_success_unique_idx" RENAME TO "app_user_purchase_record_success_unique_idx";
--> statement-breakpoint
ALTER INDEX "user_purchase_record_target_type_target_id_idx" RENAME TO "app_user_purchase_record_target_type_target_id_idx";
--> statement-breakpoint
ALTER INDEX "user_purchase_record_user_id_idx" RENAME TO "app_user_purchase_record_user_id_idx";
--> statement-breakpoint
ALTER INDEX "user_purchase_record_status_idx" RENAME TO "app_user_purchase_record_status_idx";
--> statement-breakpoint
ALTER INDEX "user_purchase_record_created_at_idx" RENAME TO "app_user_purchase_record_created_at_idx";
--> statement-breakpoint
ALTER INDEX "user_purchase_record_user_id_status_target_type_created_at__idx" RENAME TO "app_user_purchase_record_user_id_status_target_type_created_at__idx";
--> statement-breakpoint
ALTER INDEX "user_report_target_type_target_id_idx" RENAME TO "app_user_report_target_type_target_id_idx";
--> statement-breakpoint
ALTER INDEX "user_report_scene_type_scene_id_status_idx" RENAME TO "app_user_report_scene_type_scene_id_status_idx";
--> statement-breakpoint
ALTER INDEX "user_report_scene_type_status_created_at_idx" RENAME TO "app_user_report_scene_type_status_created_at_idx";
--> statement-breakpoint
ALTER INDEX "user_report_reason_type_status_created_at_idx" RENAME TO "app_user_report_reason_type_status_created_at_idx";
--> statement-breakpoint
ALTER INDEX "user_report_handler_id_status_handled_at_idx" RENAME TO "app_user_report_handler_id_status_handled_at_idx";
--> statement-breakpoint
ALTER INDEX "user_report_created_at_idx" RENAME TO "app_user_report_created_at_idx";
--> statement-breakpoint
ALTER INDEX "user_work_reading_state_user_id_work_type_last_read_at_idx" RENAME TO "app_user_work_reading_state_user_id_work_type_last_read_at_idx";
--> statement-breakpoint
ALTER INDEX "user_work_reading_state_user_id_last_read_at_idx" RENAME TO "app_user_work_reading_state_user_id_last_read_at_idx";
--> statement-breakpoint
ALTER INDEX "user_work_reading_state_work_id_idx" RENAME TO "app_user_work_reading_state_work_id_idx";
--> statement-breakpoint
ALTER INDEX "user_work_reading_state_last_read_chapter_id_idx" RENAME TO "app_user_work_reading_state_last_read_chapter_id_idx";
--> statement-breakpoint
ALTER INDEX "forum_moderator_section_section_id_idx" RENAME TO "forum_moderator_section_relation_section_id_idx";
--> statement-breakpoint
ALTER INDEX "forum_topic_tag_tag_id_created_at_idx" RENAME TO "forum_topic_tag_relation_tag_id_created_at_idx";
--> statement-breakpoint
ALTER INDEX "notification_preference_user_id_idx" RENAME TO "app_user_notification_preference_user_id_idx";
--> statement-breakpoint
ALTER INDEX "notification_preference_user_id_is_enabled_idx" RENAME TO "app_user_notification_preference_user_id_is_enabled_idx";
--> statement-breakpoint
ALTER INDEX "user_notification_user_id_is_read_created_at_idx" RENAME TO "app_user_notification_user_id_is_read_created_at_idx";
--> statement-breakpoint
ALTER INDEX "user_notification_user_id_created_at_idx" RENAME TO "app_user_notification_user_id_created_at_idx";
--> statement-breakpoint
ALTER INDEX "user_notification_type_created_at_idx" RENAME TO "app_user_notification_type_created_at_idx";
--> statement-breakpoint
ALTER INDEX "user_notification_user_id_aggregate_key_created_at_idx" RENAME TO "app_user_notification_user_id_aggregate_key_created_at_idx";
--> statement-breakpoint
ALTER INDEX "sys_config_updated_by_id_idx" RENAME TO "system_config_updated_by_id_idx";
--> statement-breakpoint
ALTER INDEX "sys_config_created_at_idx" RENAME TO "system_config_created_at_idx";
--> statement-breakpoint
ALTER INDEX "sys_dictionary_item_dictionary_code_idx" RENAME TO "system_dictionary_item_dictionary_code_idx";
--> statement-breakpoint
ALTER INDEX "sys_dictionary_item_sort_order_idx" RENAME TO "system_dictionary_item_sort_order_idx";
--> statement-breakpoint
ALTER INDEX "sys_request_log_created_at_idx" RENAME TO "system_request_log_created_at_idx";
--> statement-breakpoint
ALTER INDEX "sys_request_log_user_id_idx" RENAME TO "system_request_log_user_id_idx";
--> statement-breakpoint
ALTER INDEX "sys_request_log_username_idx" RENAME TO "system_request_log_username_idx";
--> statement-breakpoint
ALTER INDEX "sys_request_log_is_success_idx" RENAME TO "system_request_log_is_success_idx";
--> statement-breakpoint
ALTER INDEX "sensitive_word_word_idx" RENAME TO "system_sensitive_word_word_idx";
--> statement-breakpoint
ALTER INDEX "sensitive_word_type_idx" RENAME TO "system_sensitive_word_type_idx";
--> statement-breakpoint
ALTER INDEX "sensitive_word_level_idx" RENAME TO "system_sensitive_word_level_idx";
--> statement-breakpoint
ALTER INDEX "sensitive_word_is_enabled_idx" RENAME TO "system_sensitive_word_is_enabled_idx";
--> statement-breakpoint
ALTER INDEX "sensitive_word_match_mode_idx" RENAME TO "system_sensitive_word_match_mode_idx";
--> statement-breakpoint
ALTER INDEX "sensitive_word_created_at_idx" RENAME TO "system_sensitive_word_created_at_idx";
--> statement-breakpoint
COMMIT;