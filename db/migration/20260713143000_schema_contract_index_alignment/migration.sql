DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM "coupon_redemption_record"
    WHERE ("target_type" IN (1, 2) AND "target_id" IS NULL)
       OR ("target_type" IN (3, 4) AND "target_id" IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'coupon_redemption_record target reference shape is invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "user_content_entitlement"
    WHERE ("grant_source" IN (1, 2, 3) AND "source_id" IS NULL)
       OR (
         "grant_source" IN (4, 5)
         AND ("source_key" IS NULL OR length(btrim("source_key")) = 0)
       )
  ) THEN
    RAISE EXCEPTION 'user_content_entitlement grant source reference shape is invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "user_comment"
    WHERE "target_type" NOT IN (1, 2, 3, 4, 5)
       OR ("audit_role" IS NOT NULL AND "audit_role" NOT IN (0, 1))
       OR (("audit_role" IS NULL) <> ("audit_by_id" IS NULL))
  ) THEN
    RAISE EXCEPTION 'user_comment target or audit fields are invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "forum_topic"
    WHERE (("audit_role" IS NULL) <> ("audit_by_id" IS NULL))
  ) THEN
    RAISE EXCEPTION 'forum_topic audit role and actor must be paired';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "forum_hashtag"
    WHERE ("audit_role" IS NOT NULL AND "audit_role" NOT IN (0, 1))
       OR (("audit_role" IS NULL) <> ("audit_by_id" IS NULL))
  ) THEN
    RAISE EXCEPTION 'forum_hashtag audit fields are invalid';
  END IF;
END $$;--> statement-breakpoint

UPDATE "sys_dictionary_item"
SET "sort_order" = 0
WHERE "sort_order" IS NULL;--> statement-breakpoint

ALTER TABLE "coupon_redemption_record"
  ADD CONSTRAINT "coupon_redemption_record_target_reference_shape_chk"
  CHECK (
    ("target_type" IN (1, 2) AND "target_id" IS NOT NULL)
    OR ("target_type" IN (3, 4) AND "target_id" IS NULL)
  ) NOT VALID;--> statement-breakpoint
ALTER TABLE "user_content_entitlement"
  ADD CONSTRAINT "user_content_entitlement_grant_source_reference_shape_chk"
  CHECK (
    ("grant_source" IN (1, 2, 3) AND "source_id" IS NOT NULL)
    OR (
      "grant_source" IN (4, 5)
      AND "source_key" IS NOT NULL
      AND length(btrim("source_key")) > 0
    )
  ) NOT VALID;--> statement-breakpoint
ALTER TABLE "user_comment"
  ADD CONSTRAINT "user_comment_target_type_valid_chk"
  CHECK ("target_type" IN (1, 2, 3, 4, 5)) NOT VALID;--> statement-breakpoint
ALTER TABLE "user_comment"
  ADD CONSTRAINT "user_comment_audit_role_valid_chk"
  CHECK ("audit_role" IS NULL OR "audit_role" IN (0, 1)) NOT VALID;--> statement-breakpoint
ALTER TABLE "user_comment"
  ADD CONSTRAINT "user_comment_audit_actor_pair_chk"
  CHECK (("audit_role" IS NULL) = ("audit_by_id" IS NULL)) NOT VALID;--> statement-breakpoint
ALTER TABLE "forum_topic"
  ADD CONSTRAINT "forum_topic_audit_actor_pair_chk"
  CHECK (("audit_role" IS NULL) = ("audit_by_id" IS NULL)) NOT VALID;--> statement-breakpoint
ALTER TABLE "forum_hashtag"
  ADD CONSTRAINT "forum_hashtag_audit_role_valid_chk"
  CHECK ("audit_role" IS NULL OR "audit_role" IN (0, 1)) NOT VALID;--> statement-breakpoint
ALTER TABLE "forum_hashtag"
  ADD CONSTRAINT "forum_hashtag_audit_actor_pair_chk"
  CHECK (("audit_role" IS NULL) = ("audit_by_id" IS NULL)) NOT VALID;--> statement-breakpoint

ALTER TABLE "coupon_redemption_record" VALIDATE CONSTRAINT "coupon_redemption_record_target_reference_shape_chk";--> statement-breakpoint
ALTER TABLE "user_content_entitlement" VALIDATE CONSTRAINT "user_content_entitlement_grant_source_reference_shape_chk";--> statement-breakpoint
ALTER TABLE "user_comment" VALIDATE CONSTRAINT "user_comment_target_type_valid_chk";--> statement-breakpoint
ALTER TABLE "user_comment" VALIDATE CONSTRAINT "user_comment_audit_role_valid_chk";--> statement-breakpoint
ALTER TABLE "user_comment" VALIDATE CONSTRAINT "user_comment_audit_actor_pair_chk";--> statement-breakpoint
ALTER TABLE "forum_topic" VALIDATE CONSTRAINT "forum_topic_audit_actor_pair_chk";--> statement-breakpoint
ALTER TABLE "forum_hashtag" VALIDATE CONSTRAINT "forum_hashtag_audit_role_valid_chk";--> statement-breakpoint
ALTER TABLE "forum_hashtag" VALIDATE CONSTRAINT "forum_hashtag_audit_actor_pair_chk";--> statement-breakpoint

ALTER TABLE "sys_dictionary_item" ALTER COLUMN "sort_order" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "sys_dictionary_item" ALTER COLUMN "sort_order" TYPE integer USING "sort_order"::integer;--> statement-breakpoint
ALTER TABLE "sys_dictionary_item" ALTER COLUMN "sort_order" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "sys_dictionary_item" ALTER COLUMN "sort_order" SET NOT NULL;--> statement-breakpoint
ALTER SEQUENCE IF EXISTS "sys_dictionary_item_sort_order_seq" OWNED BY NONE;--> statement-breakpoint
DROP SEQUENCE IF EXISTS "sys_dictionary_item_sort_order_seq";--> statement-breakpoint

ALTER TABLE "migration_audit" DROP CONSTRAINT "migration_audit_migration_key_metric_key";--> statement-breakpoint
ALTER TABLE "migration_audit"
  ADD CONSTRAINT "migration_audit_pkey"
  PRIMARY KEY ("migration_key", "metric");--> statement-breakpoint

ALTER TABLE "app_user_count"
  RENAME CONSTRAINT "app_user_count_forum_topic_received_favorite_count_non_negative_chk"
  TO "app_user_count_forum_topic_received_fav_nonnegative_chk";--> statement-breakpoint
ALTER TABLE "content_import_item_attempt"
  RENAME CONSTRAINT "content_import_item_attempt_image_success_count_non_negative_chk"
  TO "content_import_item_attempt_image_success_nonnegative_chk";--> statement-breakpoint
ALTER TABLE "user_notification"
  RENAME CONSTRAINT "user_notification_system_announcement_requires_announcement_id_chk"
  TO "user_notification_system_announcement_requires_id_chk";--> statement-breakpoint
ALTER TABLE "work_third_party_chapter_binding"
  RENAME CONSTRAINT "work_third_party_chapter_binding_provider_chapter_id_nonblank_chk"
  TO "work_tp_chapter_binding_provider_chapter_nonblank_chk";--> statement-breakpoint
ALTER TABLE "work_third_party_source_binding"
  RENAME CONSTRAINT "work_third_party_source_binding_provider_group_path_word_nonblank_chk"
  TO "work_tp_source_binding_group_path_nonblank_chk";--> statement-breakpoint
ALTER TABLE "task_step_unique_fact"
  RENAME CONSTRAINT "task_step_unique_fact_step_id_user_id_scope_key_dimension_hash_key"
  TO "task_step_unique_fact_step_user_scope_dim_key";--> statement-breakpoint
ALTER INDEX "work_third_party_chapter_binding_source_provider_chapter_live_idx"
  RENAME TO "work_tp_chapter_binding_source_provider_chapter_live_uidx";--> statement-breakpoint

DROP INDEX "admin_user_token_jti_idx";--> statement-breakpoint
DROP INDEX "app_user_token_jti_idx";--> statement-breakpoint
DROP INDEX "app_user_phone_number_idx";--> statement-breakpoint
DROP INDEX "app_user_email_address_idx";--> statement-breakpoint
DROP INDEX "check_in_record_user_id_sign_date_idx";--> statement-breakpoint
DROP INDEX "coupon_admin_grant_job_workflow_job_id_idx";--> statement-breakpoint
DROP INDEX "message_ws_metric_bucket_at_idx";--> statement-breakpoint
DROP INDEX "sensitive_word_word_idx";--> statement-breakpoint
DROP INDEX "sys_dictionary_item_dictionary_code_idx";--> statement-breakpoint
DROP INDEX "sys_dictionary_item_sort_order_idx";--> statement-breakpoint
DROP INDEX "workflow_attempt_job_attempt_no_idx";--> statement-breakpoint
DROP INDEX "work_category_name_idx";--> statement-breakpoint
DROP INDEX "work_tag_name_idx";--> statement-breakpoint
DROP INDEX "work_forum_section_id_idx";--> statement-breakpoint

DROP INDEX "user_follow_user_id_target_type_created_at_idx";--> statement-breakpoint
CREATE INDEX "user_follow_user_id_target_type_created_at_idx"
  ON "user_follow" ("user_id", "target_type", "created_at" DESC, "id" DESC);--> statement-breakpoint
DROP INDEX "user_follow_target_type_target_id_created_at_idx";--> statement-breakpoint
CREATE INDEX "user_follow_target_type_target_id_created_at_idx"
  ON "user_follow" ("target_type", "target_id", "created_at" DESC, "id" DESC);--> statement-breakpoint

DROP INDEX "forum_governance_action_log_actor_created_at_idx";--> statement-breakpoint
CREATE INDEX "forum_governance_action_log_actor_created_at_idx"
  ON "forum_moderator_action_log" ("actor_type", "actor_user_id", "created_at" DESC, "id" DESC);--> statement-breakpoint
DROP INDEX "forum_moderator_action_log_moderator_created_at_idx";--> statement-breakpoint
CREATE INDEX "forum_moderator_action_log_moderator_created_at_idx"
  ON "forum_moderator_action_log" ("moderator_id", "created_at" DESC, "id" DESC);--> statement-breakpoint
DROP INDEX "forum_moderator_action_log_action_type_created_at_idx";--> statement-breakpoint
CREATE INDEX "forum_moderator_action_log_action_type_created_at_idx"
  ON "forum_moderator_action_log" ("action_type", "created_at" DESC, "id" DESC);--> statement-breakpoint
DROP INDEX "forum_moderator_action_log_target_created_at_idx";--> statement-breakpoint
CREATE INDEX "forum_moderator_action_log_target_created_at_idx"
  ON "forum_moderator_action_log" ("target_type", "target_id", "created_at" DESC, "id" DESC);--> statement-breakpoint
DROP INDEX "forum_moderator_action_log_created_at_idx";--> statement-breakpoint
CREATE INDEX "forum_moderator_action_log_created_at_idx"
  ON "forum_moderator_action_log" ("created_at" DESC, "id" DESC);--> statement-breakpoint

DROP INDEX "user_notification_receiver_user_id_is_read_created_at_idx";--> statement-breakpoint
CREATE INDEX "user_notification_receiver_user_id_is_read_created_at_idx"
  ON "user_notification" ("receiver_user_id", "is_hidden", "is_read", "created_at" DESC, "id" DESC);--> statement-breakpoint
DROP INDEX "user_notification_receiver_user_id_category_key_created_at_idx";--> statement-breakpoint
CREATE INDEX "user_notification_receiver_user_id_category_key_created_at_idx"
  ON "user_notification" ("receiver_user_id", "is_hidden", "category_key", "created_at" DESC, "id" DESC);--> statement-breakpoint
DROP INDEX "user_notification_receiver_user_id_created_at_idx";--> statement-breakpoint
CREATE INDEX "user_notification_receiver_user_id_created_at_idx"
  ON "user_notification" ("receiver_user_id", "is_hidden", "created_at" DESC, "id" DESC);--> statement-breakpoint

CREATE INDEX "app_agreement_log_agreement_id_idx"
  ON "app_agreement_log" ("agreement_id");--> statement-breakpoint
CREATE INDEX "app_user_active_page_id_idx"
  ON "app_user" ("id" DESC)
  WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "content_import_job_work_id_idx"
  ON "content_import_job" ("work_id");--> statement-breakpoint
CREATE INDEX "forum_topic_admin_active_section_audit_updated_idx"
  ON "forum_topic" ("section_id", "audit_status", "updated_at" DESC, "id" DESC)
  WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "notification_delivery_event_category_status_updated_id_idx"
  ON "notification_delivery" ("event_key", "category_key", "status", "updated_at" DESC, "id" DESC);--> statement-breakpoint
CREATE INDEX "payment_order_provider_config_version_id_idx"
  ON "payment_order" ("provider_config_version_id");--> statement-breakpoint
CREATE INDEX "sys_dictionary_item_dictionary_code_sort_order_id_idx"
  ON "sys_dictionary_item" ("dictionary_code", "sort_order", "id");--> statement-breakpoint
CREATE INDEX "sys_request_log_api_action_id_idx"
  ON "sys_request_log" ("api_type", "action_type", "id" DESC);--> statement-breakpoint
CREATE INDEX "task_event_failure_event_status_created_at_idx"
  ON "task_event_failure" ("event_key", "status", "created_at" DESC, "id" DESC)
  WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "user_notification_receiver_read_category_created_id_idx"
  ON "user_notification" ("receiver_user_id", "is_hidden", "is_read", "category_key", "created_at" DESC, "id" DESC);--> statement-breakpoint
