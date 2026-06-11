ALTER TABLE "work_author_relation"
  DROP CONSTRAINT IF EXISTS "work_author_relation_work_id_fkey",
  DROP CONSTRAINT IF EXISTS "work_author_relation_author_id_fkey";
--> statement-breakpoint
ALTER TABLE "emoji_asset"
  DROP CONSTRAINT IF EXISTS "emoji_asset_pack_id_fkey";
--> statement-breakpoint
ALTER TABLE "emoji_recent_usage"
  DROP CONSTRAINT IF EXISTS "emoji_recent_usage_user_id_fkey",
  DROP CONSTRAINT IF EXISTS "emoji_recent_usage_emoji_asset_id_fkey";
--> statement-breakpoint
ALTER TABLE "app_config"
  ADD COLUMN IF NOT EXISTS "config_key" varchar(32);
--> statement-breakpoint
UPDATE "app_config"
SET "config_key" = 'global'
WHERE "config_key" IS NULL OR "config_key" <> 'global';
--> statement-breakpoint
WITH ranked AS (
  SELECT
    "id",
    row_number() OVER (ORDER BY "updated_at" DESC, "id" DESC) AS rn
  FROM "app_config"
)
DELETE FROM "app_config"
WHERE "id" IN (SELECT "id" FROM ranked WHERE rn > 1);
--> statement-breakpoint
ALTER TABLE "app_config"
  ALTER COLUMN "config_key" SET DEFAULT 'global',
  ALTER COLUMN "config_key" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "app_config"
  DROP CONSTRAINT IF EXISTS "app_config_config_key_key",
  ADD CONSTRAINT "app_config_config_key_key" UNIQUE ("config_key");
--> statement-breakpoint
ALTER TABLE "app_config"
  DROP CONSTRAINT IF EXISTS "app_config_config_key_valid_chk",
  ADD CONSTRAINT "app_config_config_key_valid_chk" CHECK ("config_key" = 'global');
--> statement-breakpoint
ALTER TABLE "check_in_config"
  ADD COLUMN IF NOT EXISTS "config_key" varchar(32);
--> statement-breakpoint
UPDATE "check_in_config"
SET "config_key" = 'global'
WHERE "config_key" IS NULL OR "config_key" <> 'global';
--> statement-breakpoint
WITH ranked AS (
  SELECT
    "id",
    row_number() OVER (ORDER BY "updated_at" DESC, "id" DESC) AS rn
  FROM "check_in_config"
)
DELETE FROM "check_in_config"
WHERE "id" IN (SELECT "id" FROM ranked WHERE rn > 1);
--> statement-breakpoint
DROP INDEX IF EXISTS "check_in_config_is_enabled_idx";
--> statement-breakpoint
ALTER TABLE "check_in_config"
  ALTER COLUMN "config_key" SET DEFAULT 'global',
  ALTER COLUMN "config_key" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "check_in_config"
  DROP CONSTRAINT IF EXISTS "check_in_config_config_key_key",
  ADD CONSTRAINT "check_in_config_config_key_key" UNIQUE ("config_key");
--> statement-breakpoint
ALTER TABLE "check_in_config"
  DROP CONSTRAINT IF EXISTS "check_in_config_config_key_valid_chk",
  ADD CONSTRAINT "check_in_config_config_key_valid_chk" CHECK ("config_key" = 'global');
--> statement-breakpoint
WITH ranked AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "platform"
      ORDER BY "build_code" DESC, "id" DESC
    ) AS rn
  FROM "app_update_release"
  WHERE "is_published" = true
)
UPDATE "app_update_release" AS release
SET
  "is_published" = false,
  "updated_at" = now()
FROM ranked
WHERE release."id" = ranked."id"
  AND ranked.rn > 1;
--> statement-breakpoint
UPDATE "app_update_release"
SET "published_at" = coalesce("published_at", now())
WHERE "is_published" = true;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "app_update_release_platform_published_live_key"
  ON "app_update_release" ("platform")
  WHERE "is_published" = true;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_comment_floor_counter" (
  "id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "target_type" smallint NOT NULL,
  "target_id" integer NOT NULL,
  "next_floor" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_comment_floor_counter_target_key"
    UNIQUE ("target_type", "target_id"),
  CONSTRAINT "user_comment_floor_counter_target_type_valid_chk"
    CHECK ("target_type" IN (1,2,3,4,5)),
  CONSTRAINT "user_comment_floor_counter_target_id_positive_chk"
    CHECK ("target_id" > 0),
  CONSTRAINT "user_comment_floor_counter_next_floor_positive_chk"
    CHECK ("next_floor" > 0)
);
--> statement-breakpoint
WITH ordered_roots AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "target_type", "target_id"
      ORDER BY coalesce("floor", 2147483647), "created_at", "id"
    ) AS normalized_floor
  FROM "user_comment"
  WHERE "reply_to_id" IS NULL
)
UPDATE "user_comment" AS comment
SET "floor" = ordered_roots.normalized_floor
FROM ordered_roots
WHERE comment."id" = ordered_roots."id";
--> statement-breakpoint
INSERT INTO "user_comment_floor_counter" (
  "target_type",
  "target_id",
  "next_floor",
  "created_at",
  "updated_at"
)
SELECT
  "target_type",
  "target_id",
  max("floor") + 1,
  now(),
  now()
FROM "user_comment"
WHERE "reply_to_id" IS NULL
GROUP BY "target_type", "target_id"
ON CONFLICT ("target_type", "target_id")
DO UPDATE SET
  "next_floor" = EXCLUDED."next_floor",
  "updated_at" = now();
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_comment_floor_counter_target_next_floor_idx"
  ON "user_comment_floor_counter" ("target_type", "target_id", "next_floor");
--> statement-breakpoint
DROP INDEX IF EXISTS "user_comment_root_floor_live_key";
CREATE UNIQUE INDEX IF NOT EXISTS "user_comment_root_floor_live_key"
  ON "user_comment" ("target_type", "target_id", "floor")
  WHERE "reply_to_id" IS NULL AND "deleted_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "user_comment"
  DROP CONSTRAINT IF EXISTS "user_comment_root_floor_required_chk",
  ADD CONSTRAINT "user_comment_root_floor_required_chk"
    CHECK ("reply_to_id" IS NOT NULL OR "floor" IS NOT NULL);
--> statement-breakpoint
ALTER TABLE "work_chapter"
  ADD COLUMN IF NOT EXISTS "novel_content_path" varchar(1000),
  ADD COLUMN IF NOT EXISTS "comic_content_manifest" jsonb;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "__work_chapter_comic_content_to_jsonb"(
  raw_content text,
  chapter_id integer
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  parsed jsonb;
BEGIN
  IF raw_content IS NULL OR btrim(raw_content) = '' THEN
    RETURN NULL;
  END IF;

  IF left(btrim(raw_content), 1) <> '[' THEN
    RETURN NULL;
  END IF;

  BEGIN
    parsed := raw_content::jsonb;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;

  IF jsonb_typeof(parsed) <> 'array' THEN
    RETURN NULL;
  END IF;

  RETURN parsed;
END $$;
--> statement-breakpoint
UPDATE "work_chapter"
SET "description" = left(btrim("content"), 1000)
WHERE "work_type" = 1
  AND "content" IS NOT NULL
  AND btrim("content") <> ''
  AND ("description" IS NULL OR btrim("description") = '')
  AND "__work_chapter_comic_content_to_jsonb"("content", "id") IS NULL;
--> statement-breakpoint
WITH "comic_content_candidate" AS (
  SELECT
    "id",
    "__work_chapter_comic_content_to_jsonb"("content", "id") AS "manifest"
  FROM "work_chapter"
  WHERE "work_type" = 1
    AND "content" IS NOT NULL
    AND "comic_content_manifest" IS NULL
)
UPDATE "work_chapter"
SET "comic_content_manifest" = "comic_content_candidate"."manifest"
FROM "comic_content_candidate"
WHERE "work_chapter"."id" = "comic_content_candidate"."id"
  AND "comic_content_candidate"."manifest" IS NOT NULL;
--> statement-breakpoint
UPDATE "work_chapter"
SET "novel_content_path" = "content"
WHERE "work_type" = 2
  AND "content" IS NOT NULL
  AND "novel_content_path" IS NULL;
--> statement-breakpoint
UPDATE "work_chapter"
SET "novel_content_path" = NULL
WHERE "novel_content_path" IS NOT NULL
  AND btrim("novel_content_path") = '';
--> statement-breakpoint
DROP FUNCTION IF EXISTS "__work_chapter_comic_content_to_jsonb"(text, integer);
--> statement-breakpoint
ALTER TABLE "work_chapter"
  DROP COLUMN IF EXISTS "content";
--> statement-breakpoint
ALTER TABLE "work_chapter"
  DROP CONSTRAINT IF EXISTS "work_chapter_content_type_valid_chk",
  ADD CONSTRAINT "work_chapter_content_type_valid_chk"
    CHECK (
      ("work_type" = 1 AND "novel_content_path" IS NULL)
      OR ("work_type" = 2 AND "comic_content_manifest" IS NULL)
    );
--> statement-breakpoint
ALTER TABLE "work_chapter"
  DROP CONSTRAINT IF EXISTS "work_chapter_novel_content_path_non_blank_chk",
  ADD CONSTRAINT "work_chapter_novel_content_path_non_blank_chk"
    CHECK (
      "novel_content_path" IS NULL
      OR btrim("novel_content_path") <> ''
    );
--> statement-breakpoint
ALTER TABLE "work_chapter"
  DROP CONSTRAINT IF EXISTS "work_chapter_comic_manifest_array_chk",
  ADD CONSTRAINT "work_chapter_comic_manifest_array_chk"
    CHECK (
      "comic_content_manifest" IS NULL
      OR jsonb_typeof("comic_content_manifest") = 'array'
    );
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_chapter_work_published_publish_sort_idx"
  ON "work_chapter" (
    "work_id",
    "is_published",
    "publish_at",
    "deleted_at",
    "sort_order",
    "id"
  );
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_section_user_level_rule_id_idx"
  ON "forum_section" ("user_level_rule_id");
CREATE INDEX IF NOT EXISTS "forum_section_last_topic_id_idx"
  ON "forum_section" ("last_topic_id");
CREATE INDEX IF NOT EXISTS "forum_topic_last_comment_user_id_idx"
  ON "forum_topic" ("last_comment_user_id");
CREATE INDEX IF NOT EXISTS "forum_moderator_lifecycle_log_actor_admin_user_id_idx"
  ON "forum_moderator_lifecycle_log" ("actor_admin_user_id");
CREATE INDEX IF NOT EXISTS "chat_conversation_last_sender_id_idx"
  ON "chat_conversation" ("last_sender_id");
CREATE INDEX IF NOT EXISTS "notification_delivery_notification_id_idx"
  ON "notification_delivery" ("notification_id");
CREATE INDEX IF NOT EXISTS "user_notification_actor_user_id_idx"
  ON "user_notification" ("actor_user_id");
CREATE INDEX IF NOT EXISTS "payment_notify_event_payment_order_id_idx"
  ON "payment_notify_event" ("payment_order_id");
CREATE INDEX IF NOT EXISTS "payment_reconciliation_record_payment_order_id_idx"
  ON "payment_reconciliation_record" ("payment_order_id");
CREATE INDEX IF NOT EXISTS "membership_plan_benefit_benefit_id_idx"
  ON "membership_plan_benefit" ("benefit_id");
CREATE INDEX IF NOT EXISTS "user_membership_subscription_plan_id_idx"
  ON "user_membership_subscription" ("plan_id");
CREATE INDEX IF NOT EXISTS "user_coupon_instance_coupon_definition_id_idx"
  ON "user_coupon_instance" ("coupon_definition_id");
CREATE INDEX IF NOT EXISTS "task_event_log_step_id_idx"
  ON "task_event_log" ("step_id");
CREATE INDEX IF NOT EXISTS "task_definition_created_by_id_idx"
  ON "task_definition" ("created_by_id");
CREATE INDEX IF NOT EXISTS "task_definition_updated_by_id_idx"
  ON "task_definition" ("updated_by_id");
CREATE INDEX IF NOT EXISTS "user_report_disposition_attempt_actor_user_id_idx"
  ON "user_report_disposition_attempt" ("actor_user_id");
CREATE INDEX IF NOT EXISTS "app_config_updated_by_id_idx"
  ON "app_config" ("updated_by_id");
CREATE INDEX IF NOT EXISTS "check_in_config_updated_by_id_idx"
  ON "check_in_config" ("updated_by_id");
CREATE INDEX IF NOT EXISTS "app_update_release_created_by_id_idx"
  ON "app_update_release" ("created_by_id");
CREATE INDEX IF NOT EXISTS "app_update_release_updated_by_id_idx"
  ON "app_update_release" ("updated_by_id");
CREATE INDEX IF NOT EXISTS "check_in_streak_rule_updated_by_id_idx"
  ON "check_in_streak_rule" ("updated_by_id");
CREATE INDEX IF NOT EXISTS "emoji_pack_created_by_id_idx"
  ON "emoji_pack" ("created_by_id");
CREATE INDEX IF NOT EXISTS "emoji_pack_updated_by_id_idx"
  ON "emoji_pack" ("updated_by_id");
CREATE INDEX IF NOT EXISTS "emoji_asset_created_by_id_idx"
  ON "emoji_asset" ("created_by_id");
CREATE INDEX IF NOT EXISTS "emoji_asset_updated_by_id_idx"
  ON "emoji_asset" ("updated_by_id");
--> statement-breakpoint
ALTER TABLE "sys_request_log"
  ADD COLUMN IF NOT EXISTS "retention_until" timestamp(6) with time zone,
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp(6) with time zone;
ALTER TABLE "domain_event_dispatch"
  ADD COLUMN IF NOT EXISTS "retention_until" timestamp(6) with time zone,
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp(6) with time zone;
ALTER TABLE "notification_delivery"
  ADD COLUMN IF NOT EXISTS "retention_until" timestamp(6) with time zone,
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp(6) with time zone;
ALTER TABLE "user_notification"
  ADD COLUMN IF NOT EXISTS "retention_until" timestamp(6) with time zone,
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp(6) with time zone;
ALTER TABLE "chat_message"
  ADD COLUMN IF NOT EXISTS "retention_until" timestamp(6) with time zone,
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp(6) with time zone;
ALTER TABLE "chat_conversation"
  ADD COLUMN IF NOT EXISTS "retention_until" timestamp(6) with time zone,
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp(6) with time zone;
ALTER TABLE "user_comment"
  ADD COLUMN IF NOT EXISTS "retention_until" timestamp(6) with time zone,
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp(6) with time zone;
ALTER TABLE "forum_user_action_log"
  ADD COLUMN IF NOT EXISTS "retention_until" timestamp(6) with time zone,
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp(6) with time zone;
ALTER TABLE "task_event_log"
  ADD COLUMN IF NOT EXISTS "retention_until" timestamp(6) with time zone,
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp(6) with time zone;
ALTER TABLE "growth_audit_log"
  ADD COLUMN IF NOT EXISTS "retention_until" timestamp(6) with time zone,
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp(6) with time zone;
ALTER TABLE "growth_ledger_record"
  ADD COLUMN IF NOT EXISTS "retention_until" timestamp(6) with time zone,
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp(6) with time zone;
ALTER TABLE "user_browse_log"
  ADD COLUMN IF NOT EXISTS "retention_until" timestamp(6) with time zone,
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp(6) with time zone;
ALTER TABLE "sensitive_word_hit_log"
  ADD COLUMN IF NOT EXISTS "retention_until" timestamp(6) with time zone,
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp(6) with time zone;
ALTER TABLE "payment_notify_event"
  ADD COLUMN IF NOT EXISTS "retention_until" timestamp(6) with time zone,
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp(6) with time zone;
--> statement-breakpoint
ALTER TABLE "sys_request_log"
  ALTER COLUMN "retention_until" SET DEFAULT (now() + interval '180 days');
ALTER TABLE "domain_event_dispatch"
  ALTER COLUMN "retention_until" SET DEFAULT (now() + interval '90 days');
ALTER TABLE "notification_delivery"
  ALTER COLUMN "retention_until" SET DEFAULT (now() + interval '180 days');
ALTER TABLE "user_notification"
  ALTER COLUMN "retention_until" SET DEFAULT (now() + interval '180 days');
ALTER TABLE "chat_message"
  ALTER COLUMN "retention_until" SET DEFAULT (now() + interval '365 days');
ALTER TABLE "chat_conversation"
  ALTER COLUMN "retention_until" SET DEFAULT (now() + interval '365 days');
ALTER TABLE "user_comment"
  ALTER COLUMN "retention_until" SET DEFAULT (now() + interval '365 days');
ALTER TABLE "forum_user_action_log"
  ALTER COLUMN "retention_until" SET DEFAULT (now() + interval '180 days');
ALTER TABLE "task_event_log"
  ALTER COLUMN "retention_until" SET DEFAULT (now() + interval '180 days');
ALTER TABLE "growth_audit_log"
  ALTER COLUMN "retention_until" SET DEFAULT (now() + interval '365 days');
ALTER TABLE "growth_ledger_record"
  ALTER COLUMN "retention_until" SET DEFAULT (now() + interval '730 days');
ALTER TABLE "user_browse_log"
  ALTER COLUMN "retention_until" SET DEFAULT (now() + interval '180 days');
ALTER TABLE "sensitive_word_hit_log"
  ALTER COLUMN "retention_until" SET DEFAULT (now() + interval '180 days');
ALTER TABLE "payment_notify_event"
  ALTER COLUMN "retention_until" SET DEFAULT (now() + interval '730 days');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sys_request_log_created_at_id_idx"
  ON "sys_request_log" ("created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "sys_request_log_retention_until_id_idx"
  ON "sys_request_log" ("retention_until", "id");
CREATE INDEX IF NOT EXISTS "sys_request_log_api_action_created_id_idx"
  ON "sys_request_log" ("api_type", "action_type", "created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "sys_request_log_user_created_id_idx"
  ON "sys_request_log" ("user_id", "created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "sys_request_log_success_created_id_idx"
  ON "sys_request_log" ("is_success", "created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "domain_event_dispatch_status_next_retry_id_idx"
  ON "domain_event_dispatch" ("status", "next_retry_at", "id");
CREATE INDEX IF NOT EXISTS "domain_event_dispatch_retention_until_id_idx"
  ON "domain_event_dispatch" ("retention_until", "id");
CREATE INDEX IF NOT EXISTS "notification_delivery_receiver_created_at_id_idx"
  ON "notification_delivery" ("receiver_user_id", "created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "notification_delivery_retention_until_id_idx"
  ON "notification_delivery" ("retention_until", "id");
CREATE INDEX IF NOT EXISTS "user_notification_receiver_created_at_id_idx"
  ON "user_notification" ("receiver_user_id", "created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "user_notification_retention_until_id_idx"
  ON "user_notification" ("retention_until", "id");
CREATE INDEX IF NOT EXISTS "chat_message_conversation_created_at_id_idx"
  ON "chat_message" ("conversation_id", "created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "chat_message_conversation_seq_desc_idx"
  ON "chat_message" ("conversation_id", "message_seq" DESC);
CREATE INDEX IF NOT EXISTS "chat_message_retention_until_id_idx"
  ON "chat_message" ("retention_until", "id");
CREATE INDEX IF NOT EXISTS "chat_conversation_last_message_at_id_idx"
  ON "chat_conversation" ("last_message_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "chat_conversation_retention_until_id_idx"
  ON "chat_conversation" ("retention_until", "id");
CREATE INDEX IF NOT EXISTS "user_comment_target_root_floor_id_idx"
  ON "user_comment" ("target_type", "target_id", "floor", "id")
  WHERE "reply_to_id" IS NULL
    AND "audit_status" = 1
    AND "is_hidden" = false
    AND "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "user_comment_target_visible_created_id_idx"
  ON "user_comment" ("target_type", "target_id", "created_at" DESC, "id" DESC)
  WHERE "audit_status" = 1
    AND "is_hidden" = false
    AND "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "user_comment_target_visible_like_id_idx"
  ON "user_comment" ("target_type", "target_id", "like_count" DESC, "created_at" DESC, "id" DESC)
  WHERE "audit_status" = 1
    AND "is_hidden" = false
    AND "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "user_comment_retention_until_id_idx"
  ON "user_comment" ("retention_until", "id");
CREATE INDEX IF NOT EXISTS "forum_user_action_log_retention_until_id_idx"
  ON "forum_user_action_log" ("retention_until", "id");
CREATE INDEX IF NOT EXISTS "forum_user_action_log_user_created_id_idx"
  ON "forum_user_action_log" ("user_id", "created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "forum_user_action_log_target_created_id_idx"
  ON "forum_user_action_log" ("target_type", "target_id", "created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "task_event_log_instance_created_at_id_idx"
  ON "task_event_log" ("instance_id", "created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "task_event_log_retention_until_id_idx"
  ON "task_event_log" ("retention_until", "id");
CREATE INDEX IF NOT EXISTS "growth_audit_log_user_created_id_idx"
  ON "growth_audit_log" ("user_id", "created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "growth_audit_log_asset_type_created_id_idx"
  ON "growth_audit_log" ("asset_type", "created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "growth_audit_log_retention_until_id_idx"
  ON "growth_audit_log" ("retention_until", "id");
CREATE INDEX IF NOT EXISTS "growth_ledger_record_user_created_id_idx"
  ON "growth_ledger_record" ("user_id", "created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "growth_ledger_record_user_asset_id_desc_idx"
  ON "growth_ledger_record" ("user_id", "asset_type", "id" DESC);
CREATE INDEX IF NOT EXISTS "growth_ledger_record_retention_until_id_idx"
  ON "growth_ledger_record" ("retention_until", "id");
CREATE INDEX IF NOT EXISTS "user_browse_log_user_viewed_at_id_idx"
  ON "user_browse_log" ("user_id", "viewed_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "user_browse_log_target_viewed_at_id_idx"
  ON "user_browse_log" ("target_type", "target_id", "viewed_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "user_browse_log_retention_until_id_idx"
  ON "user_browse_log" ("retention_until", "id");
CREATE INDEX IF NOT EXISTS "sensitive_word_hit_log_retention_until_id_idx"
  ON "sensitive_word_hit_log" ("retention_until", "id");
CREATE INDEX IF NOT EXISTS "payment_notify_event_channel_process_created_id_idx"
  ON "payment_notify_event" ("channel", "process_status", "created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "payment_notify_event_retention_until_id_idx"
  ON "payment_notify_event" ("retention_until", "id");
