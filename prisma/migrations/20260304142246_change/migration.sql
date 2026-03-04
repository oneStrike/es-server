-- CreateTable
CREATE TABLE "admin_user_token" (
    "id" SERIAL NOT NULL,
    "jti" VARCHAR(255) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_type" VARCHAR(20) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "revoke_reason" VARCHAR(50),
    "device_info" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "admin_user_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_user" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(20) NOT NULL,
    "password" VARCHAR(500) NOT NULL,
    "mobile" VARCHAR(11),
    "avatar" VARCHAR(200),
    "role" SMALLINT NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(6),
    "last_login_ip" VARCHAR(45),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "admin_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_agreement" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "is_force" BOOLEAN NOT NULL DEFAULT false,
    "show_in_auth" BOOLEAN NOT NULL DEFAULT false,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_agreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_agreement_log" (
    "id" BIGSERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "agreement_id" INTEGER NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "agreed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(45),
    "device_info" VARCHAR(500),

    CONSTRAINT "app_agreement_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_announcement_read" (
    "id" SERIAL NOT NULL,
    "announcement_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "read_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_announcement_read_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_announcement" (
    "id" SERIAL NOT NULL,
    "page_id" INTEGER,
    "title" VARCHAR(100) NOT NULL,
    "content" TEXT NOT NULL,
    "summary" VARCHAR(500),
    "announcement_type" SMALLINT NOT NULL DEFAULT 0,
    "priority_level" SMALLINT NOT NULL DEFAULT 1,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "show_as_popup" BOOLEAN NOT NULL DEFAULT false,
    "popup_background_image" VARCHAR(200),
    "enable_platform" INTEGER[],
    "publish_start_time" TIMESTAMPTZ(6),
    "publish_end_time" TIMESTAMPTZ(6),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_config" (
    "id" SERIAL NOT NULL,
    "app_name" VARCHAR(100) NOT NULL,
    "app_desc" VARCHAR(500),
    "app_logo" VARCHAR(500),
    "onboarding_image" VARCHAR(1000),
    "theme_color" VARCHAR(20) NOT NULL DEFAULT '#007AFF',
    "secondary_color" VARCHAR(20),
    "optional_theme_colors" VARCHAR(500),
    "enable_maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "maintenance_message" VARCHAR(500),
    "version" VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    "updated_by_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_page" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "path" VARCHAR(300) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "access_level" SMALLINT NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "enable_platform" INTEGER[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_user_token" (
    "id" SERIAL NOT NULL,
    "jti" VARCHAR(255) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_type" VARCHAR(20) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "revoke_reason" VARCHAR(50),
    "device_info" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "app_user_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_user" (
    "id" SERIAL NOT NULL,
    "account" VARCHAR(20) NOT NULL,
    "phone_number" VARCHAR(20),
    "email_address" VARCHAR(255),
    "level_id" INTEGER,
    "nickname" VARCHAR(100) NOT NULL,
    "password" VARCHAR(500) NOT NULL,
    "avatar_url" VARCHAR(500),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "gender_type" SMALLINT NOT NULL DEFAULT 0,
    "birth_date" DATE,
    "points" INTEGER NOT NULL DEFAULT 0,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "status" INTEGER NOT NULL DEFAULT 1,
    "ban_reason" VARCHAR(500),
    "ban_until" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ,
    "last_login_ip" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignment" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "cycle_key" VARCHAR(32) NOT NULL,
    "status" SMALLINT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "target" INTEGER NOT NULL DEFAULT 1,
    "task_snapshot" JSONB,
    "context" JSONB,
    "version" INTEGER NOT NULL DEFAULT 0,
    "claimed_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "expired_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "task_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_progress_log" (
    "id" SERIAL NOT NULL,
    "assignment_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "action_type" SMALLINT NOT NULL,
    "delta" INTEGER NOT NULL,
    "before_value" INTEGER NOT NULL,
    "after_value" INTEGER NOT NULL,
    "context" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_progress_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000),
    "cover" VARCHAR(255),
    "type" SMALLINT NOT NULL,
    "status" SMALLINT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" SMALLINT NOT NULL DEFAULT 0,
    "claim_mode" SMALLINT NOT NULL,
    "complete_mode" SMALLINT NOT NULL,
    "target_count" INTEGER NOT NULL DEFAULT 1,
    "reward_config" JSONB,
    "repeat_rule" JSONB,
    "publish_start_at" TIMESTAMPTZ(6),
    "publish_end_at" TIMESTAMPTZ(6),
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badge_assignment" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "badge_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badge_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badge" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "type" SMALLINT NOT NULL,
    "description" VARCHAR(200),
    "icon" VARCHAR(255),
    "business" VARCHAR(20),
    "event_key" VARCHAR(50),
    "sortOrder" SMALLINT NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_comment_like" (
    "id" SERIAL NOT NULL,
    "comment_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_comment_like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_comment_report" (
    "id" SERIAL NOT NULL,
    "reporter_id" INTEGER NOT NULL,
    "handler_id" INTEGER,
    "comment_id" INTEGER NOT NULL,
    "reason" VARCHAR(50) NOT NULL,
    "description" VARCHAR(500),
    "evidence_url" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "handling_note" VARCHAR(500),
    "handled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_comment_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_comment" (
    "id" SERIAL NOT NULL,
    "target_type" SMALLINT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "floor" INTEGER,
    "reply_to_id" INTEGER,
    "actual_reply_to_id" INTEGER,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "audit_status" SMALLINT NOT NULL DEFAULT 0,
    "audit_by_id" INTEGER,
    "audit_role" SMALLINT,
    "audit_reason" VARCHAR(500),
    "audit_at" TIMESTAMPTZ(6),
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "sensitive_word_hits" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_download_record" (
    "id" SERIAL NOT NULL,
    "target_type" SMALLINT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_download_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_experience_record" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "rule_id" INTEGER,
    "event_id" INTEGER,
    "experience" INTEGER NOT NULL,
    "before_experience" INTEGER NOT NULL,
    "after_experience" INTEGER NOT NULL,
    "event_key" VARCHAR(50),
    "remark" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_experience_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_experience_rule" (
    "id" SERIAL NOT NULL,
    "type" SMALLINT NOT NULL,
    "experience" INTEGER NOT NULL,
    "daily_limit" INTEGER NOT NULL DEFAULT 0,
    "total_limit" INTEGER NOT NULL DEFAULT 0,
    "cooldown_seconds" INTEGER NOT NULL DEFAULT 0,
    "business" VARCHAR(20),
    "event_key" VARCHAR(50),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "remark" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_experience_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_favorite" (
    "id" SERIAL NOT NULL,
    "target_type" SMALLINT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_growth_event_archive" (
    "id" SERIAL NOT NULL,
    "source_id" INTEGER NOT NULL,
    "business" VARCHAR(20) NOT NULL,
    "event_key" VARCHAR(50) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "target_id" INTEGER,
    "ip" VARCHAR(45),
    "device_id" VARCHAR(100),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "rule_refs" JSONB,
    "points_delta_applied" INTEGER NOT NULL DEFAULT 0,
    "experience_delta_applied" INTEGER NOT NULL DEFAULT 0,
    "badge_assigned" JSONB,
    "context" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "archived_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_growth_event_archive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_growth_event" (
    "id" SERIAL NOT NULL,
    "business" VARCHAR(20) NOT NULL,
    "event_key" VARCHAR(50) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "target_id" INTEGER,
    "ip" VARCHAR(45),
    "device_id" VARCHAR(100),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "rule_refs" JSONB,
    "points_delta_applied" INTEGER NOT NULL DEFAULT 0,
    "experience_delta_applied" INTEGER NOT NULL DEFAULT 0,
    "badge_assigned" JSONB,
    "context" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_growth_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_level_rule" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "required_experience" INTEGER NOT NULL,
    "login_days" SMALLINT NOT NULL DEFAULT 0,
    "description" VARCHAR(200),
    "icon" VARCHAR(255),
    "badge" VARCHAR(255),
    "color" VARCHAR(20),
    "sortOrder" SMALLINT NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "business" VARCHAR(20),
    "daily_topic_limit" SMALLINT NOT NULL DEFAULT 0,
    "daily_reply_comment_limit" SMALLINT NOT NULL DEFAULT 0,
    "post_interval" SMALLINT NOT NULL DEFAULT 0,
    "daily_like_limit" SMALLINT NOT NULL DEFAULT 0,
    "daily_favorite_limit" SMALLINT NOT NULL DEFAULT 0,
    "blacklist_limit" SMALLINT NOT NULL DEFAULT 10,
    "work_collection_limit" SMALLINT NOT NULL DEFAULT 100,
    "discount" DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_level_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_like" (
    "id" SERIAL NOT NULL,
    "target_type" SMALLINT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_point_record" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "rule_id" INTEGER,
    "event_id" INTEGER,
    "target_type" SMALLINT,
    "target_id" INTEGER,
    "exchange_id" INTEGER,
    "purchase_id" INTEGER,
    "points" INTEGER NOT NULL,
    "before_points" INTEGER NOT NULL,
    "after_points" INTEGER NOT NULL,
    "event_key" VARCHAR(50),
    "remark" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_point_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_point_rule" (
    "id" SERIAL NOT NULL,
    "type" SMALLINT NOT NULL,
    "points" INTEGER NOT NULL,
    "daily_limit" INTEGER NOT NULL DEFAULT 0,
    "total_limit" INTEGER NOT NULL DEFAULT 0,
    "cooldown_seconds" INTEGER NOT NULL DEFAULT 0,
    "business" VARCHAR(20),
    "event_key" VARCHAR(50),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "remark" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_point_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_purchase_record" (
    "id" SERIAL NOT NULL,
    "target_type" SMALLINT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "status" SMALLINT NOT NULL DEFAULT 1,
    "payment_method" SMALLINT NOT NULL,
    "out_trade_no" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_purchase_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_view" (
    "id" SERIAL NOT NULL,
    "target_type" SMALLINT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "ip_address" VARCHAR(45),
    "device" VARCHAR(20),
    "user_agent" VARCHAR(500),
    "viewed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_view_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_config_history" (
    "id" SERIAL NOT NULL,
    "config_id" INTEGER NOT NULL,
    "operated_by_id" INTEGER,
    "changes" JSONB NOT NULL,
    "change_type" VARCHAR(20) NOT NULL,
    "reason" VARCHAR(500),
    "ip_address" VARCHAR(50),
    "user_agent" VARCHAR(500),
    "operated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_config_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_config" (
    "id" SERIAL NOT NULL,
    "updated_by_id" INTEGER,
    "site_name" VARCHAR(100) NOT NULL,
    "site_description" VARCHAR(500),
    "site_keywords" VARCHAR(200),
    "site_logo" VARCHAR(255),
    "site_favicon" VARCHAR(255),
    "contact_email" VARCHAR(100),
    "icp_number" VARCHAR(50),
    "topic_title_max_length" INTEGER NOT NULL DEFAULT 200,
    "topic_content_max_length" INTEGER NOT NULL DEFAULT 10000,
    "reply_content_max_length" INTEGER NOT NULL DEFAULT 5000,
    "review_policy" INTEGER NOT NULL DEFAULT 1,
    "allow_anonymous_view" BOOLEAN NOT NULL DEFAULT true,
    "allow_anonymous_post" BOOLEAN NOT NULL DEFAULT false,
    "allow_anonymous_reply" BOOLEAN NOT NULL DEFAULT false,
    "allow_user_register" BOOLEAN NOT NULL DEFAULT true,
    "register_require_email_verify" BOOLEAN NOT NULL DEFAULT true,
    "register_require_phone_verify" BOOLEAN NOT NULL DEFAULT false,
    "username_min_length" INTEGER NOT NULL DEFAULT 3,
    "username_max_length" INTEGER NOT NULL DEFAULT 20,
    "signature_max_length" INTEGER NOT NULL DEFAULT 200,
    "bio_max_length" INTEGER NOT NULL DEFAULT 500,
    "default_points_for_new_user" INTEGER NOT NULL DEFAULT 100,
    "enable_email_notification" BOOLEAN NOT NULL DEFAULT true,
    "enable_in_app_notification" BOOLEAN NOT NULL DEFAULT true,
    "enable_new_topic_notification" BOOLEAN NOT NULL DEFAULT true,
    "enable_new_reply_notification" BOOLEAN NOT NULL DEFAULT true,
    "enable_like_notification" BOOLEAN NOT NULL DEFAULT true,
    "enable_favorite_notification" BOOLEAN NOT NULL DEFAULT true,
    "enable_system_notification" BOOLEAN NOT NULL DEFAULT true,
    "enable_maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "maintenance_message" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "forum_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_moderator_action_log" (
    "id" SERIAL NOT NULL,
    "moderator_id" INTEGER NOT NULL,
    "target_id" INTEGER NOT NULL,
    "action_type" SMALLINT NOT NULL,
    "target_type" SMALLINT NOT NULL,
    "action_description" VARCHAR(200) NOT NULL,
    "before_data" TEXT,
    "after_data" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_moderator_action_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_moderator_application" (
    "id" SERIAL NOT NULL,
    "applicant_id" INTEGER NOT NULL,
    "section_id" INTEGER NOT NULL,
    "audit_by_id" INTEGER,
    "status" SMALLINT NOT NULL DEFAULT 0,
    "permissions" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "reason" VARCHAR(500) NOT NULL,
    "audit_reason" VARCHAR(500),
    "remark" VARCHAR(500),
    "audit_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "forum_moderator_application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_moderator_section" (
    "id" SERIAL NOT NULL,
    "moderator_id" INTEGER NOT NULL,
    "section_id" INTEGER NOT NULL,
    "permissions" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "forum_moderator_section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_moderator" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "group_id" INTEGER,
    "role_type" INTEGER NOT NULL DEFAULT 3,
    "permissions" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "remark" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "forum_moderator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_notification" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "topic_id" INTEGER,
    "reply_id" INTEGER,
    "type" SMALLINT NOT NULL,
    "priority" SMALLINT NOT NULL DEFAULT 1,
    "title" VARCHAR(200) NOT NULL,
    "content" VARCHAR(1000) NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(6),
    "expired_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_profile" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "topic_count" INTEGER NOT NULL DEFAULT 0,
    "reply_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "favorite_count" INTEGER NOT NULL DEFAULT 0,
    "signature" VARCHAR(200),
    "bio" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "forum_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_reply_like" (
    "id" SERIAL NOT NULL,
    "reply_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_reply_like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_reply" (
    "id" SERIAL NOT NULL,
    "topic_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "reply_to_id" INTEGER,
    "actual_reply_to_id" INTEGER,
    "content" TEXT NOT NULL,
    "floor" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "audit_status" SMALLINT NOT NULL DEFAULT 0,
    "audit_reason" TEXT,
    "sensitive_word_hits" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "forum_reply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_report" (
    "id" SERIAL NOT NULL,
    "reporter_id" INTEGER NOT NULL,
    "handler_id" INTEGER,
    "target_id" INTEGER NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "reason" VARCHAR(50) NOT NULL,
    "description" VARCHAR(500),
    "evidence_url" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "handling_note" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "forum_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_section_group" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(500),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "max_moderators" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "forum_section_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_section" (
    "id" SERIAL NOT NULL,
    "group_id" INTEGER,
    "user_level_rule_id" INTEGER,
    "last_topic_id" INTEGER,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(500),
    "icon" VARCHAR(255),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "topic_review_policy" INTEGER NOT NULL DEFAULT 1,
    "remark" VARCHAR(500),
    "topic_count" INTEGER NOT NULL DEFAULT 0,
    "reply_count" INTEGER NOT NULL DEFAULT 0,
    "last_post_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "forum_section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_tag" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "icon" VARCHAR(255),
    "description" VARCHAR(200),
    "sortOrder" SMALLINT NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "forum_tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_topic_tag" (
    "id" SERIAL NOT NULL,
    "topic_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_topic_tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_topic" (
    "id" SERIAL NOT NULL,
    "section_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "last_reply_user_id" INTEGER,
    "audit_by_id" INTEGER,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "audit_status" SMALLINT NOT NULL DEFAULT 1,
    "audit_role" SMALLINT,
    "audit_reason" VARCHAR(500),
    "audit_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,
    "sensitive_word_hits" JSONB,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "reply_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "favorite_count" INTEGER NOT NULL DEFAULT 0,
    "last_reply_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "forum_topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_user_action_log" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "target_id" INTEGER NOT NULL,
    "action_type" SMALLINT NOT NULL,
    "target_type" SMALLINT NOT NULL,
    "before_data" TEXT,
    "after_data" TEXT,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_user_action_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_request_log" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "username" TEXT,
    "api_type" VARCHAR(20),
    "method" VARCHAR(10) NOT NULL,
    "path" VARCHAR(255) NOT NULL,
    "params" JSONB,
    "ip" VARCHAR(45),
    "user_agent" VARCHAR(255),
    "device" JSONB,
    "action_type" VARCHAR(50),
    "is_success" BOOLEAN NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sys_request_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensitive_word" (
    "id" SERIAL NOT NULL,
    "word" VARCHAR(100) NOT NULL,
    "replace_word" VARCHAR(100),
    "level" SMALLINT NOT NULL DEFAULT 2,
    "type" SMALLINT NOT NULL DEFAULT 5,
    "match_mode" SMALLINT NOT NULL DEFAULT 1,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "remark" VARCHAR(500),
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "last_hit_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sensitive_word_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_config" (
    "id" SERIAL NOT NULL,
    "updated_by_id" INTEGER,
    "aliyun_config" JSONB,
    "growth_antifraud_config" JSONB,
    "content_review_policy" JSONB,
    "comment_rate_limit_config" JSONB,
    "site_config" JSONB,
    "maintenance_config" JSONB,
    "register_config" JSONB,
    "notify_config" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sys_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_dictionary" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "cover" VARCHAR(200),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "sys_dictionary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_dictionary_item" (
    "id" SERIAL NOT NULL,
    "dictionary_code" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "sort_order" SMALLSERIAL,
    "cover" VARCHAR(200),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "sys_dictionary_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_author" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "avatar" VARCHAR(500),
    "description" VARCHAR(1000),
    "nationality" VARCHAR(50),
    "gender" SMALLINT NOT NULL DEFAULT 0,
    "type" SMALLINT[],
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_recommended" BOOLEAN NOT NULL DEFAULT false,
    "remark" VARCHAR(1000),
    "work_count" INTEGER NOT NULL DEFAULT 0,
    "followers_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "work_author_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_comic" (
    "id" SERIAL NOT NULL,
    "workId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "work_comic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_novel" (
    "id" SERIAL NOT NULL,
    "workId" INTEGER NOT NULL,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "work_novel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_author_relation" (
    "id" SERIAL NOT NULL,
    "work_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "work_author_relation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_category_relation" (
    "work_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_category_relation_pkey" PRIMARY KEY ("work_id","category_id")
);

-- CreateTable
CREATE TABLE "work_category" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "description" VARCHAR(200),
    "icon" VARCHAR(255),
    "content_type" INTEGER[],
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "work_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_chapter" (
    "id" SERIAL NOT NULL,
    "work_id" INTEGER NOT NULL,
    "work_type" SMALLINT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "subtitle" VARCHAR(200),
    "cover" VARCHAR(500),
    "description" VARCHAR(1000),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "is_preview" BOOLEAN NOT NULL DEFAULT false,
    "publish_at" TIMESTAMPTZ(6),
    "view_rule" SMALLINT NOT NULL DEFAULT -1,
    "required_read_level_id" INTEGER,
    "price" INTEGER NOT NULL DEFAULT 0,
    "can_download" BOOLEAN NOT NULL DEFAULT true,
    "can_comment" BOOLEAN NOT NULL DEFAULT true,
    "content" TEXT,
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "purchase_count" INTEGER NOT NULL DEFAULT 0,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "remark" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "work_chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_comment_report" (
    "id" SERIAL NOT NULL,
    "comment_id" INTEGER NOT NULL,
    "reporter_id" INTEGER NOT NULL,
    "handler_id" INTEGER,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "evidence_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "handling_note" TEXT,
    "handled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "work_comment_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_comment" (
    "id" SERIAL NOT NULL,
    "work_id" INTEGER NOT NULL,
    "work_type" INTEGER NOT NULL,
    "chapter_id" INTEGER,
    "user_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "floor" INTEGER NOT NULL DEFAULT 0,
    "reply_to_id" INTEGER,
    "actual_reply_to_id" INTEGER,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "audit_status" INTEGER NOT NULL DEFAULT 1,
    "audit_by_id" INTEGER,
    "audit_role" SMALLINT,
    "audit_reason" TEXT,
    "audit_at" TIMESTAMPTZ(6),
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "sensitive_word_hits" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "work_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_tag_relation" (
    "work_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "work_tag_relation_pkey" PRIMARY KEY ("work_id","tag_id")
);

-- CreateTable
CREATE TABLE "work_tag" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "icon" VARCHAR(255),
    "description" VARCHAR(200),
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "work_tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work" (
    "id" SERIAL NOT NULL,
    "type" SMALLINT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "alias" VARCHAR(200),
    "cover" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "region" VARCHAR(10) NOT NULL,
    "ageRating" VARCHAR(10),
    "serialStatus" SMALLINT NOT NULL DEFAULT 0,
    "publisher" VARCHAR(100),
    "originalSource" VARCHAR(100),
    "copyright" VARCHAR(500),
    "disclaimer" TEXT,
    "remark" VARCHAR(1000),
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "isRecommended" BOOLEAN NOT NULL DEFAULT false,
    "isHot" BOOLEAN NOT NULL DEFAULT false,
    "isNew" BOOLEAN NOT NULL DEFAULT false,
    "publishAt" DATE,
    "lastUpdated" TIMESTAMPTZ(6),
    "view_rule" SMALLINT NOT NULL DEFAULT 0,
    "required_view_level_id" INTEGER,
    "chapter_price" INTEGER NOT NULL DEFAULT 0,
    "can_comment" BOOLEAN NOT NULL DEFAULT true,
    "recommendWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "favoriteCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "work_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_user_token_jti_key" ON "admin_user_token"("jti");

-- CreateIndex
CREATE INDEX "admin_user_token_user_id_idx" ON "admin_user_token"("user_id");

-- CreateIndex
CREATE INDEX "admin_user_token_jti_idx" ON "admin_user_token"("jti");

-- CreateIndex
CREATE INDEX "admin_user_token_token_type_idx" ON "admin_user_token"("token_type");

-- CreateIndex
CREATE INDEX "admin_user_token_expires_at_idx" ON "admin_user_token"("expires_at");

-- CreateIndex
CREATE INDEX "admin_user_token_revoked_at_idx" ON "admin_user_token"("revoked_at");

-- CreateIndex
CREATE INDEX "admin_user_token_user_id_token_type_idx" ON "admin_user_token"("user_id", "token_type");

-- CreateIndex
CREATE UNIQUE INDEX "admin_user_username_key" ON "admin_user"("username");

-- CreateIndex
CREATE INDEX "admin_user_is_enabled_idx" ON "admin_user"("is_enabled");

-- CreateIndex
CREATE INDEX "admin_user_role_idx" ON "admin_user"("role");

-- CreateIndex
CREATE INDEX "admin_user_created_at_idx" ON "admin_user"("created_at");

-- CreateIndex
CREATE INDEX "admin_user_last_login_at_idx" ON "admin_user"("last_login_at");

-- CreateIndex
CREATE INDEX "app_agreement_title_is_published_idx" ON "app_agreement"("title", "is_published");

-- CreateIndex
CREATE UNIQUE INDEX "app_agreement_title_version_key" ON "app_agreement"("title", "version");

-- CreateIndex
CREATE INDEX "app_agreement_log_user_id_agreement_id_idx" ON "app_agreement_log"("user_id", "agreement_id");

-- CreateIndex
CREATE INDEX "app_agreement_log_agreed_at_idx" ON "app_agreement_log"("agreed_at");

-- CreateIndex
CREATE INDEX "app_announcement_read_announcement_id_idx" ON "app_announcement_read"("announcement_id");

-- CreateIndex
CREATE INDEX "app_announcement_read_user_id_idx" ON "app_announcement_read"("user_id");

-- CreateIndex
CREATE INDEX "app_announcement_read_read_at_idx" ON "app_announcement_read"("read_at");

-- CreateIndex
CREATE UNIQUE INDEX "app_announcement_read_announcement_id_user_id_key" ON "app_announcement_read"("announcement_id", "user_id");

-- CreateIndex
CREATE INDEX "app_announcement_is_published_publish_start_time_publish_en_idx" ON "app_announcement"("is_published", "publish_start_time", "publish_end_time");

-- CreateIndex
CREATE INDEX "app_announcement_announcement_type_is_published_idx" ON "app_announcement"("announcement_type", "is_published");

-- CreateIndex
CREATE INDEX "app_announcement_priority_level_is_pinned_idx" ON "app_announcement"("priority_level", "is_pinned");

-- CreateIndex
CREATE INDEX "app_announcement_created_at_idx" ON "app_announcement"("created_at");

-- CreateIndex
CREATE INDEX "app_announcement_page_id_idx" ON "app_announcement"("page_id");

-- CreateIndex
CREATE INDEX "app_announcement_show_as_popup_is_published_idx" ON "app_announcement"("show_as_popup", "is_published");

-- CreateIndex
CREATE INDEX "app_config_updated_by_id_idx" ON "app_config"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_page_code_key" ON "app_page"("code");

-- CreateIndex
CREATE UNIQUE INDEX "app_page_path_key" ON "app_page"("path");

-- CreateIndex
CREATE INDEX "app_page_access_level_is_enabled_idx" ON "app_page"("access_level", "is_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_token_jti_key" ON "app_user_token"("jti");

-- CreateIndex
CREATE INDEX "app_user_token_user_id_idx" ON "app_user_token"("user_id");

-- CreateIndex
CREATE INDEX "app_user_token_jti_idx" ON "app_user_token"("jti");

-- CreateIndex
CREATE INDEX "app_user_token_token_type_idx" ON "app_user_token"("token_type");

-- CreateIndex
CREATE INDEX "app_user_token_expires_at_idx" ON "app_user_token"("expires_at");

-- CreateIndex
CREATE INDEX "app_user_token_revoked_at_idx" ON "app_user_token"("revoked_at");

-- CreateIndex
CREATE INDEX "app_user_token_user_id_token_type_idx" ON "app_user_token"("user_id", "token_type");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_account_key" ON "app_user"("account");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_phone_number_key" ON "app_user"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_address_key" ON "app_user"("email_address");

-- CreateIndex
CREATE INDEX "app_user_is_enabled_idx" ON "app_user"("is_enabled");

-- CreateIndex
CREATE INDEX "app_user_gender_type_idx" ON "app_user"("gender_type");

-- CreateIndex
CREATE INDEX "app_user_created_at_idx" ON "app_user"("created_at");

-- CreateIndex
CREATE INDEX "app_user_last_login_at_idx" ON "app_user"("last_login_at");

-- CreateIndex
CREATE INDEX "app_user_phone_number_idx" ON "app_user"("phone_number");

-- CreateIndex
CREATE INDEX "app_user_email_address_idx" ON "app_user"("email_address");

-- CreateIndex
CREATE INDEX "app_user_points_idx" ON "app_user"("points");

-- CreateIndex
CREATE INDEX "app_user_status_idx" ON "app_user"("status");

-- CreateIndex
CREATE INDEX "app_user_level_id_idx" ON "app_user"("level_id");

-- CreateIndex
CREATE INDEX "task_assignment_user_id_status_idx" ON "task_assignment"("user_id", "status");

-- CreateIndex
CREATE INDEX "task_assignment_task_id_idx" ON "task_assignment"("task_id");

-- CreateIndex
CREATE INDEX "task_assignment_completed_at_idx" ON "task_assignment"("completed_at");

-- CreateIndex
CREATE INDEX "task_assignment_expired_at_idx" ON "task_assignment"("expired_at");

-- CreateIndex
CREATE INDEX "task_assignment_deleted_at_idx" ON "task_assignment"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "task_assignment_task_id_user_id_cycle_key_key" ON "task_assignment"("task_id", "user_id", "cycle_key");

-- CreateIndex
CREATE INDEX "task_progress_log_assignment_id_idx" ON "task_progress_log"("assignment_id");

-- CreateIndex
CREATE INDEX "task_progress_log_user_id_created_at_idx" ON "task_progress_log"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "task_code_key" ON "task"("code");

-- CreateIndex
CREATE INDEX "task_status_is_enabled_idx" ON "task"("status", "is_enabled");

-- CreateIndex
CREATE INDEX "task_type_idx" ON "task"("type");

-- CreateIndex
CREATE INDEX "task_publish_start_at_idx" ON "task"("publish_start_at");

-- CreateIndex
CREATE INDEX "task_publish_end_at_idx" ON "task"("publish_end_at");

-- CreateIndex
CREATE INDEX "task_created_at_idx" ON "task"("created_at");

-- CreateIndex
CREATE INDEX "task_deleted_at_idx" ON "task"("deleted_at");

-- CreateIndex
CREATE INDEX "user_badge_assignment_user_id_idx" ON "user_badge_assignment"("user_id");

-- CreateIndex
CREATE INDEX "user_badge_assignment_badge_id_idx" ON "user_badge_assignment"("badge_id");

-- CreateIndex
CREATE INDEX "user_badge_assignment_created_at_idx" ON "user_badge_assignment"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_badge_assignment_user_id_badge_id_key" ON "user_badge_assignment"("user_id", "badge_id");

-- CreateIndex
CREATE INDEX "user_badge_type_idx" ON "user_badge"("type");

-- CreateIndex
CREATE INDEX "user_badge_business_event_key_idx" ON "user_badge"("business", "event_key");

-- CreateIndex
CREATE INDEX "user_badge_sortOrder_idx" ON "user_badge"("sortOrder");

-- CreateIndex
CREATE INDEX "user_badge_is_enabled_idx" ON "user_badge"("is_enabled");

-- CreateIndex
CREATE INDEX "user_badge_created_at_idx" ON "user_badge"("created_at");

-- CreateIndex
CREATE INDEX "user_comment_like_comment_id_idx" ON "user_comment_like"("comment_id");

-- CreateIndex
CREATE INDEX "user_comment_like_user_id_idx" ON "user_comment_like"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_comment_like_comment_id_user_id_key" ON "user_comment_like"("comment_id", "user_id");

-- CreateIndex
CREATE INDEX "user_comment_report_comment_id_idx" ON "user_comment_report"("comment_id");

-- CreateIndex
CREATE INDEX "user_comment_report_reporter_id_idx" ON "user_comment_report"("reporter_id");

-- CreateIndex
CREATE INDEX "user_comment_report_status_idx" ON "user_comment_report"("status");

-- CreateIndex
CREATE INDEX "user_comment_report_created_at_idx" ON "user_comment_report"("created_at");

-- CreateIndex
CREATE INDEX "user_comment_target_type_target_id_created_at_idx" ON "user_comment"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "user_comment_target_type_target_id_audit_status_is_hidden_d_idx" ON "user_comment"("target_type", "target_id", "audit_status", "is_hidden", "deleted_at");

-- CreateIndex
CREATE INDEX "user_comment_target_type_target_id_deleted_at_created_at_idx" ON "user_comment"("target_type", "target_id", "deleted_at", "created_at");

-- CreateIndex
CREATE INDEX "user_comment_user_id_idx" ON "user_comment"("user_id");

-- CreateIndex
CREATE INDEX "user_comment_created_at_idx" ON "user_comment"("created_at");

-- CreateIndex
CREATE INDEX "user_comment_audit_status_idx" ON "user_comment"("audit_status");

-- CreateIndex
CREATE INDEX "user_comment_is_hidden_idx" ON "user_comment"("is_hidden");

-- CreateIndex
CREATE INDEX "user_comment_reply_to_id_idx" ON "user_comment"("reply_to_id");

-- CreateIndex
CREATE INDEX "user_comment_actual_reply_to_id_idx" ON "user_comment"("actual_reply_to_id");

-- CreateIndex
CREATE INDEX "user_comment_deleted_at_idx" ON "user_comment"("deleted_at");

-- CreateIndex
CREATE INDEX "user_download_record_target_type_target_id_idx" ON "user_download_record"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "user_download_record_user_id_idx" ON "user_download_record"("user_id");

-- CreateIndex
CREATE INDEX "user_download_record_created_at_idx" ON "user_download_record"("created_at");

-- CreateIndex
CREATE INDEX "user_experience_record_user_id_idx" ON "user_experience_record"("user_id");

-- CreateIndex
CREATE INDEX "user_experience_record_rule_id_idx" ON "user_experience_record"("rule_id");

-- CreateIndex
CREATE INDEX "user_experience_record_event_id_idx" ON "user_experience_record"("event_id");

-- CreateIndex
CREATE INDEX "user_experience_record_created_at_idx" ON "user_experience_record"("created_at");

-- CreateIndex
CREATE INDEX "user_experience_record_user_id_created_at_idx" ON "user_experience_record"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_experience_rule_type_key" ON "user_experience_rule"("type");

-- CreateIndex
CREATE INDEX "user_experience_rule_type_idx" ON "user_experience_rule"("type");

-- CreateIndex
CREATE INDEX "user_experience_rule_is_enabled_idx" ON "user_experience_rule"("is_enabled");

-- CreateIndex
CREATE INDEX "user_experience_rule_created_at_idx" ON "user_experience_rule"("created_at");

-- CreateIndex
CREATE INDEX "user_favorite_target_type_target_id_idx" ON "user_favorite"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "user_favorite_user_id_idx" ON "user_favorite"("user_id");

-- CreateIndex
CREATE INDEX "user_favorite_created_at_idx" ON "user_favorite"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_favorite_target_type_target_id_user_id_key" ON "user_favorite"("target_type", "target_id", "user_id");

-- CreateIndex
CREATE INDEX "user_growth_event_archive_source_id_idx" ON "user_growth_event_archive"("source_id");

-- CreateIndex
CREATE INDEX "user_growth_event_archive_user_id_idx" ON "user_growth_event_archive"("user_id");

-- CreateIndex
CREATE INDEX "user_growth_event_archive_occurred_at_idx" ON "user_growth_event_archive"("occurred_at");

-- CreateIndex
CREATE INDEX "user_growth_event_business_event_key_idx" ON "user_growth_event"("business", "event_key");

-- CreateIndex
CREATE INDEX "user_growth_event_user_id_idx" ON "user_growth_event"("user_id");

-- CreateIndex
CREATE INDEX "user_growth_event_occurred_at_idx" ON "user_growth_event"("occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_level_rule_name_key" ON "user_level_rule"("name");

-- CreateIndex
CREATE INDEX "user_level_rule_is_enabled_sortOrder_idx" ON "user_level_rule"("is_enabled", "sortOrder");

-- CreateIndex
CREATE INDEX "user_like_target_type_target_id_idx" ON "user_like"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "user_like_user_id_idx" ON "user_like"("user_id");

-- CreateIndex
CREATE INDEX "user_like_created_at_idx" ON "user_like"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_like_target_type_target_id_user_id_key" ON "user_like"("target_type", "target_id", "user_id");

-- CreateIndex
CREATE INDEX "user_point_record_user_id_idx" ON "user_point_record"("user_id");

-- CreateIndex
CREATE INDEX "user_point_record_rule_id_idx" ON "user_point_record"("rule_id");

-- CreateIndex
CREATE INDEX "user_point_record_event_id_idx" ON "user_point_record"("event_id");

-- CreateIndex
CREATE INDEX "user_point_record_created_at_idx" ON "user_point_record"("created_at");

-- CreateIndex
CREATE INDEX "user_point_record_user_id_created_at_idx" ON "user_point_record"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "user_point_record_target_type_target_id_idx" ON "user_point_record"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "user_point_record_exchange_id_idx" ON "user_point_record"("exchange_id");

-- CreateIndex
CREATE INDEX "user_point_record_purchase_id_idx" ON "user_point_record"("purchase_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_point_rule_type_key" ON "user_point_rule"("type");

-- CreateIndex
CREATE INDEX "user_point_rule_type_idx" ON "user_point_rule"("type");

-- CreateIndex
CREATE INDEX "user_point_rule_is_enabled_idx" ON "user_point_rule"("is_enabled");

-- CreateIndex
CREATE INDEX "user_point_rule_created_at_idx" ON "user_point_rule"("created_at");

-- CreateIndex
CREATE INDEX "user_purchase_record_target_type_target_id_idx" ON "user_purchase_record"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "user_purchase_record_user_id_idx" ON "user_purchase_record"("user_id");

-- CreateIndex
CREATE INDEX "user_purchase_record_status_idx" ON "user_purchase_record"("status");

-- CreateIndex
CREATE INDEX "user_purchase_record_created_at_idx" ON "user_purchase_record"("created_at");

-- CreateIndex
CREATE INDEX "user_purchase_record_user_id_status_target_type_created_at__idx" ON "user_purchase_record"("user_id", "status", "target_type", "created_at", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_purchase_record_target_type_target_id_user_id_status_key" ON "user_purchase_record"("target_type", "target_id", "user_id", "status");

-- CreateIndex
CREATE INDEX "user_view_target_type_target_id_idx" ON "user_view"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "user_view_user_id_idx" ON "user_view"("user_id");

-- CreateIndex
CREATE INDEX "user_view_viewed_at_idx" ON "user_view"("viewed_at");

-- CreateIndex
CREATE INDEX "user_view_target_type_target_id_user_id_idx" ON "user_view"("target_type", "target_id", "user_id");

-- CreateIndex
CREATE INDEX "user_view_user_id_viewed_at_idx" ON "user_view"("user_id", "viewed_at");

-- CreateIndex
CREATE INDEX "forum_config_history_config_id_idx" ON "forum_config_history"("config_id");

-- CreateIndex
CREATE INDEX "forum_config_history_change_type_idx" ON "forum_config_history"("change_type");

-- CreateIndex
CREATE INDEX "forum_config_history_operated_by_id_idx" ON "forum_config_history"("operated_by_id");

-- CreateIndex
CREATE INDEX "forum_config_history_operated_at_idx" ON "forum_config_history"("operated_at");

-- CreateIndex
CREATE INDEX "forum_config_updated_by_id_idx" ON "forum_config"("updated_by_id");

-- CreateIndex
CREATE INDEX "forum_config_created_at_idx" ON "forum_config"("created_at");

-- CreateIndex
CREATE INDEX "forum_moderator_action_log_moderator_id_idx" ON "forum_moderator_action_log"("moderator_id");

-- CreateIndex
CREATE INDEX "forum_moderator_action_log_action_type_idx" ON "forum_moderator_action_log"("action_type");

-- CreateIndex
CREATE INDEX "forum_moderator_action_log_target_type_target_id_idx" ON "forum_moderator_action_log"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "forum_moderator_action_log_created_at_idx" ON "forum_moderator_action_log"("created_at");

-- CreateIndex
CREATE INDEX "forum_moderator_application_applicant_id_idx" ON "forum_moderator_application"("applicant_id");

-- CreateIndex
CREATE INDEX "forum_moderator_application_section_id_idx" ON "forum_moderator_application"("section_id");

-- CreateIndex
CREATE INDEX "forum_moderator_application_status_idx" ON "forum_moderator_application"("status");

-- CreateIndex
CREATE INDEX "forum_moderator_application_audit_by_id_idx" ON "forum_moderator_application"("audit_by_id");

-- CreateIndex
CREATE INDEX "forum_moderator_application_created_at_idx" ON "forum_moderator_application"("created_at");

-- CreateIndex
CREATE INDEX "forum_moderator_application_deleted_at_idx" ON "forum_moderator_application"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "forum_moderator_application_applicant_id_section_id_key" ON "forum_moderator_application"("applicant_id", "section_id");

-- CreateIndex
CREATE INDEX "forum_moderator_section_moderator_id_idx" ON "forum_moderator_section"("moderator_id");

-- CreateIndex
CREATE INDEX "forum_moderator_section_section_id_idx" ON "forum_moderator_section"("section_id");

-- CreateIndex
CREATE INDEX "forum_moderator_section_created_at_idx" ON "forum_moderator_section"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "forum_moderator_section_moderator_id_section_id_key" ON "forum_moderator_section"("moderator_id", "section_id");

-- CreateIndex
CREATE UNIQUE INDEX "forum_moderator_user_id_key" ON "forum_moderator"("user_id");

-- CreateIndex
CREATE INDEX "forum_moderator_group_id_idx" ON "forum_moderator"("group_id");

-- CreateIndex
CREATE INDEX "forum_moderator_role_type_idx" ON "forum_moderator"("role_type");

-- CreateIndex
CREATE INDEX "forum_moderator_is_enabled_idx" ON "forum_moderator"("is_enabled");

-- CreateIndex
CREATE INDEX "forum_moderator_created_at_idx" ON "forum_moderator"("created_at");

-- CreateIndex
CREATE INDEX "forum_moderator_deleted_at_idx" ON "forum_moderator"("deleted_at");

-- CreateIndex
CREATE INDEX "forum_notification_user_id_idx" ON "forum_notification"("user_id");

-- CreateIndex
CREATE INDEX "forum_notification_topic_id_idx" ON "forum_notification"("topic_id");

-- CreateIndex
CREATE INDEX "forum_notification_reply_id_idx" ON "forum_notification"("reply_id");

-- CreateIndex
CREATE INDEX "forum_notification_type_idx" ON "forum_notification"("type");

-- CreateIndex
CREATE INDEX "forum_notification_priority_idx" ON "forum_notification"("priority");

-- CreateIndex
CREATE INDEX "forum_notification_is_read_idx" ON "forum_notification"("is_read");

-- CreateIndex
CREATE INDEX "forum_notification_expired_at_idx" ON "forum_notification"("expired_at");

-- CreateIndex
CREATE INDEX "forum_notification_created_at_idx" ON "forum_notification"("created_at");

-- CreateIndex
CREATE INDEX "forum_notification_user_id_is_read_idx" ON "forum_notification"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "forum_notification_user_id_priority_idx" ON "forum_notification"("user_id", "priority");

-- CreateIndex
CREATE INDEX "forum_notification_user_id_created_at_idx" ON "forum_notification"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "forum_profile_user_id_key" ON "forum_profile"("user_id");

-- CreateIndex
CREATE INDEX "forum_profile_topic_count_idx" ON "forum_profile"("topic_count");

-- CreateIndex
CREATE INDEX "forum_profile_reply_count_idx" ON "forum_profile"("reply_count");

-- CreateIndex
CREATE INDEX "forum_profile_like_count_idx" ON "forum_profile"("like_count");

-- CreateIndex
CREATE INDEX "forum_profile_favorite_count_idx" ON "forum_profile"("favorite_count");

-- CreateIndex
CREATE INDEX "forum_profile_created_at_idx" ON "forum_profile"("created_at");

-- CreateIndex
CREATE INDEX "forum_reply_like_reply_id_idx" ON "forum_reply_like"("reply_id");

-- CreateIndex
CREATE INDEX "forum_reply_like_user_id_idx" ON "forum_reply_like"("user_id");

-- CreateIndex
CREATE INDEX "forum_reply_like_created_at_idx" ON "forum_reply_like"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "forum_reply_like_reply_id_user_id_key" ON "forum_reply_like"("reply_id", "user_id");

-- CreateIndex
CREATE INDEX "forum_reply_topic_id_idx" ON "forum_reply"("topic_id");

-- CreateIndex
CREATE INDEX "forum_reply_user_id_idx" ON "forum_reply"("user_id");

-- CreateIndex
CREATE INDEX "forum_reply_reply_to_id_idx" ON "forum_reply"("reply_to_id");

-- CreateIndex
CREATE INDEX "forum_reply_actual_reply_to_id_idx" ON "forum_reply"("actual_reply_to_id");

-- CreateIndex
CREATE INDEX "forum_reply_created_at_idx" ON "forum_reply"("created_at");

-- CreateIndex
CREATE INDEX "forum_reply_deleted_at_idx" ON "forum_reply"("deleted_at");

-- CreateIndex
CREATE INDEX "forum_reply_audit_status_idx" ON "forum_reply"("audit_status");

-- CreateIndex
CREATE INDEX "forum_report_reporter_id_idx" ON "forum_report"("reporter_id");

-- CreateIndex
CREATE INDEX "forum_report_handler_id_idx" ON "forum_report"("handler_id");

-- CreateIndex
CREATE INDEX "forum_report_type_idx" ON "forum_report"("type");

-- CreateIndex
CREATE INDEX "forum_report_target_id_idx" ON "forum_report"("target_id");

-- CreateIndex
CREATE INDEX "forum_report_status_idx" ON "forum_report"("status");

-- CreateIndex
CREATE INDEX "forum_report_created_at_idx" ON "forum_report"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "forum_section_group_name_key" ON "forum_section_group"("name");

-- CreateIndex
CREATE INDEX "forum_section_group_sort_order_idx" ON "forum_section_group"("sort_order");

-- CreateIndex
CREATE INDEX "forum_section_group_is_enabled_idx" ON "forum_section_group"("is_enabled");

-- CreateIndex
CREATE INDEX "forum_section_group_created_at_idx" ON "forum_section_group"("created_at");

-- CreateIndex
CREATE INDEX "forum_section_group_deleted_at_idx" ON "forum_section_group"("deleted_at");

-- CreateIndex
CREATE INDEX "forum_section_group_id_idx" ON "forum_section"("group_id");

-- CreateIndex
CREATE INDEX "forum_section_sort_order_idx" ON "forum_section"("sort_order");

-- CreateIndex
CREATE INDEX "forum_section_is_enabled_idx" ON "forum_section"("is_enabled");

-- CreateIndex
CREATE INDEX "forum_section_topic_count_idx" ON "forum_section"("topic_count");

-- CreateIndex
CREATE INDEX "forum_section_last_post_at_idx" ON "forum_section"("last_post_at");

-- CreateIndex
CREATE INDEX "forum_section_created_at_idx" ON "forum_section"("created_at");

-- CreateIndex
CREATE INDEX "forum_section_deleted_at_idx" ON "forum_section"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "forum_tag_name_key" ON "forum_tag"("name");

-- CreateIndex
CREATE INDEX "forum_tag_sortOrder_idx" ON "forum_tag"("sortOrder");

-- CreateIndex
CREATE INDEX "forum_tag_name_idx" ON "forum_tag"("name");

-- CreateIndex
CREATE INDEX "forum_tag_is_enabled_idx" ON "forum_tag"("is_enabled");

-- CreateIndex
CREATE INDEX "forum_tag_use_count_idx" ON "forum_tag"("use_count");

-- CreateIndex
CREATE INDEX "forum_tag_created_at_idx" ON "forum_tag"("created_at");

-- CreateIndex
CREATE INDEX "forum_topic_tag_topic_id_idx" ON "forum_topic_tag"("topic_id");

-- CreateIndex
CREATE INDEX "forum_topic_tag_tag_id_idx" ON "forum_topic_tag"("tag_id");

-- CreateIndex
CREATE INDEX "forum_topic_tag_created_at_idx" ON "forum_topic_tag"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "forum_topic_tag_topic_id_tag_id_key" ON "forum_topic_tag"("topic_id", "tag_id");

-- CreateIndex
CREATE INDEX "forum_topic_section_id_idx" ON "forum_topic"("section_id");

-- CreateIndex
CREATE INDEX "forum_topic_user_id_idx" ON "forum_topic"("user_id");

-- CreateIndex
CREATE INDEX "forum_topic_is_pinned_created_at_idx" ON "forum_topic"("is_pinned", "created_at");

-- CreateIndex
CREATE INDEX "forum_topic_is_featured_created_at_idx" ON "forum_topic"("is_featured", "created_at");

-- CreateIndex
CREATE INDEX "forum_topic_is_locked_idx" ON "forum_topic"("is_locked");

-- CreateIndex
CREATE INDEX "forum_topic_is_hidden_idx" ON "forum_topic"("is_hidden");

-- CreateIndex
CREATE INDEX "forum_topic_audit_status_idx" ON "forum_topic"("audit_status");

-- CreateIndex
CREATE INDEX "forum_topic_view_count_idx" ON "forum_topic"("view_count");

-- CreateIndex
CREATE INDEX "forum_topic_reply_count_idx" ON "forum_topic"("reply_count");

-- CreateIndex
CREATE INDEX "forum_topic_like_count_idx" ON "forum_topic"("like_count");

-- CreateIndex
CREATE INDEX "forum_topic_comment_count_idx" ON "forum_topic"("comment_count");

-- CreateIndex
CREATE INDEX "forum_topic_favorite_count_idx" ON "forum_topic"("favorite_count");

-- CreateIndex
CREATE INDEX "forum_topic_last_reply_at_idx" ON "forum_topic"("last_reply_at");

-- CreateIndex
CREATE INDEX "forum_topic_created_at_idx" ON "forum_topic"("created_at");

-- CreateIndex
CREATE INDEX "forum_topic_updated_at_idx" ON "forum_topic"("updated_at");

-- CreateIndex
CREATE INDEX "forum_topic_deleted_at_idx" ON "forum_topic"("deleted_at");

-- CreateIndex
CREATE INDEX "forum_topic_section_id_is_pinned_created_at_idx" ON "forum_topic"("section_id", "is_pinned", "created_at");

-- CreateIndex
CREATE INDEX "forum_topic_section_id_is_featured_created_at_idx" ON "forum_topic"("section_id", "is_featured", "created_at");

-- CreateIndex
CREATE INDEX "forum_topic_section_id_last_reply_at_idx" ON "forum_topic"("section_id", "last_reply_at");

-- CreateIndex
CREATE INDEX "forum_user_action_log_user_id_idx" ON "forum_user_action_log"("user_id");

-- CreateIndex
CREATE INDEX "forum_user_action_log_action_type_idx" ON "forum_user_action_log"("action_type");

-- CreateIndex
CREATE INDEX "forum_user_action_log_target_type_target_id_idx" ON "forum_user_action_log"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "forum_user_action_log_ip_address_idx" ON "forum_user_action_log"("ip_address");

-- CreateIndex
CREATE INDEX "forum_user_action_log_created_at_idx" ON "forum_user_action_log"("created_at");

-- CreateIndex
CREATE INDEX "forum_user_action_log_user_id_created_at_idx" ON "forum_user_action_log"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "sys_request_log_created_at_idx" ON "sys_request_log"("created_at");

-- CreateIndex
CREATE INDEX "sys_request_log_user_id_idx" ON "sys_request_log"("user_id");

-- CreateIndex
CREATE INDEX "sys_request_log_username_idx" ON "sys_request_log"("username");

-- CreateIndex
CREATE INDEX "sys_request_log_is_success_idx" ON "sys_request_log"("is_success");

-- CreateIndex
CREATE UNIQUE INDEX "sensitive_word_word_key" ON "sensitive_word"("word");

-- CreateIndex
CREATE INDEX "sensitive_word_word_idx" ON "sensitive_word"("word");

-- CreateIndex
CREATE INDEX "sensitive_word_type_idx" ON "sensitive_word"("type");

-- CreateIndex
CREATE INDEX "sensitive_word_level_idx" ON "sensitive_word"("level");

-- CreateIndex
CREATE INDEX "sensitive_word_is_enabled_idx" ON "sensitive_word"("is_enabled");

-- CreateIndex
CREATE INDEX "sensitive_word_match_mode_idx" ON "sensitive_word"("match_mode");

-- CreateIndex
CREATE INDEX "sensitive_word_created_at_idx" ON "sensitive_word"("created_at");

-- CreateIndex
CREATE INDEX "sys_config_updated_by_id_idx" ON "sys_config"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "sys_dictionary_name_key" ON "sys_dictionary"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sys_dictionary_code_key" ON "sys_dictionary"("code");

-- CreateIndex
CREATE INDEX "sys_dictionary_item_dictionary_code_idx" ON "sys_dictionary_item"("dictionary_code");

-- CreateIndex
CREATE INDEX "sys_dictionary_item_sort_order_idx" ON "sys_dictionary_item"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "sys_dictionary_item_dictionary_code_code_key" ON "sys_dictionary_item"("dictionary_code", "code");

-- CreateIndex
CREATE UNIQUE INDEX "work_author_name_key" ON "work_author"("name");

-- CreateIndex
CREATE INDEX "work_author_type_idx" ON "work_author"("type");

-- CreateIndex
CREATE INDEX "work_author_is_enabled_idx" ON "work_author"("is_enabled");

-- CreateIndex
CREATE INDEX "work_author_is_enabled_is_recommended_idx" ON "work_author"("is_enabled", "is_recommended");

-- CreateIndex
CREATE INDEX "work_author_is_enabled_deleted_at_idx" ON "work_author"("is_enabled", "deleted_at");

-- CreateIndex
CREATE INDEX "work_author_nationality_idx" ON "work_author"("nationality");

-- CreateIndex
CREATE INDEX "work_author_gender_idx" ON "work_author"("gender");

-- CreateIndex
CREATE INDEX "work_author_is_recommended_work_count_idx" ON "work_author"("is_recommended", "work_count" DESC);

-- CreateIndex
CREATE INDEX "work_author_created_at_idx" ON "work_author"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "work_comic_workId_key" ON "work_comic"("workId");

-- CreateIndex
CREATE UNIQUE INDEX "work_novel_workId_key" ON "work_novel"("workId");

-- CreateIndex
CREATE INDEX "work_author_relation_work_id_idx" ON "work_author_relation"("work_id");

-- CreateIndex
CREATE INDEX "work_author_relation_author_id_idx" ON "work_author_relation"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_author_relation_work_id_author_id_key" ON "work_author_relation"("work_id", "author_id");

-- CreateIndex
CREATE INDEX "work_category_relation_category_id_idx" ON "work_category_relation"("category_id");

-- CreateIndex
CREATE INDEX "work_category_relation_sort_order_idx" ON "work_category_relation"("sort_order");

-- CreateIndex
CREATE INDEX "work_category_relation_work_id_sort_order_idx" ON "work_category_relation"("work_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "work_category_name_key" ON "work_category"("name");

-- CreateIndex
CREATE INDEX "work_category_sort_order_idx" ON "work_category"("sort_order");

-- CreateIndex
CREATE INDEX "work_category_name_idx" ON "work_category"("name");

-- CreateIndex
CREATE INDEX "work_category_content_type_idx" ON "work_category"("content_type");

-- CreateIndex
CREATE INDEX "work_chapter_work_id_idx" ON "work_chapter"("work_id");

-- CreateIndex
CREATE INDEX "work_chapter_work_id_sort_order_idx" ON "work_chapter"("work_id", "sort_order");

-- CreateIndex
CREATE INDEX "work_chapter_is_published_publish_at_idx" ON "work_chapter"("is_published", "publish_at");

-- CreateIndex
CREATE INDEX "work_chapter_view_rule_idx" ON "work_chapter"("view_rule");

-- CreateIndex
CREATE INDEX "work_chapter_is_preview_idx" ON "work_chapter"("is_preview");

-- CreateIndex
CREATE INDEX "work_chapter_view_count_idx" ON "work_chapter"("view_count");

-- CreateIndex
CREATE INDEX "work_chapter_like_count_idx" ON "work_chapter"("like_count");

-- CreateIndex
CREATE INDEX "work_chapter_created_at_idx" ON "work_chapter"("created_at");

-- CreateIndex
CREATE INDEX "work_chapter_publish_at_idx" ON "work_chapter"("publish_at");

-- CreateIndex
CREATE INDEX "work_chapter_required_read_level_id_idx" ON "work_chapter"("required_read_level_id");

-- CreateIndex
CREATE INDEX "work_chapter_work_type_idx" ON "work_chapter"("work_type");

-- CreateIndex
CREATE UNIQUE INDEX "work_chapter_work_id_sort_order_key" ON "work_chapter"("work_id", "sort_order");

-- CreateIndex
CREATE INDEX "work_comment_report_comment_id_idx" ON "work_comment_report"("comment_id");

-- CreateIndex
CREATE INDEX "work_comment_report_reporter_id_idx" ON "work_comment_report"("reporter_id");

-- CreateIndex
CREATE INDEX "work_comment_report_handler_id_idx" ON "work_comment_report"("handler_id");

-- CreateIndex
CREATE INDEX "work_comment_report_status_idx" ON "work_comment_report"("status");

-- CreateIndex
CREATE INDEX "work_comment_report_created_at_idx" ON "work_comment_report"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "work_comment_report_comment_id_reporter_id_key" ON "work_comment_report"("comment_id", "reporter_id");

-- CreateIndex
CREATE INDEX "work_comment_work_id_idx" ON "work_comment"("work_id");

-- CreateIndex
CREATE INDEX "work_comment_chapter_id_idx" ON "work_comment"("chapter_id");

-- CreateIndex
CREATE INDEX "work_comment_user_id_idx" ON "work_comment"("user_id");

-- CreateIndex
CREATE INDEX "work_comment_audit_status_idx" ON "work_comment"("audit_status");

-- CreateIndex
CREATE INDEX "work_comment_created_at_idx" ON "work_comment"("created_at");

-- CreateIndex
CREATE INDEX "work_comment_deleted_at_idx" ON "work_comment"("deleted_at");

-- CreateIndex
CREATE INDEX "work_tag_relation_tag_id_idx" ON "work_tag_relation"("tag_id");

-- CreateIndex
CREATE INDEX "work_tag_relation_work_id_idx" ON "work_tag_relation"("work_id");

-- CreateIndex
CREATE INDEX "work_tag_relation_sort_order_idx" ON "work_tag_relation"("sort_order");

-- CreateIndex
CREATE INDEX "work_tag_relation_work_id_sort_order_idx" ON "work_tag_relation"("work_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "work_tag_name_key" ON "work_tag"("name");

-- CreateIndex
CREATE INDEX "work_tag_sort_order_idx" ON "work_tag"("sort_order");

-- CreateIndex
CREATE INDEX "work_tag_name_idx" ON "work_tag"("name");

-- CreateIndex
CREATE INDEX "work_tag_is_enabled_idx" ON "work_tag"("is_enabled");

-- CreateIndex
CREATE INDEX "work_isPublished_publishAt_idx" ON "work"("isPublished", "publishAt");

-- CreateIndex
CREATE INDEX "work_popularity_idx" ON "work"("popularity");

-- CreateIndex
CREATE INDEX "work_language_region_idx" ON "work"("language", "region");

-- CreateIndex
CREATE INDEX "work_serialStatus_idx" ON "work"("serialStatus");

-- CreateIndex
CREATE INDEX "work_lastUpdated_idx" ON "work"("lastUpdated");

-- CreateIndex
CREATE INDEX "work_name_idx" ON "work"("name");

-- CreateIndex
CREATE INDEX "work_isRecommended_idx" ON "work"("isRecommended");

-- CreateIndex
CREATE INDEX "work_isHot_isNew_idx" ON "work"("isHot", "isNew");

-- CreateIndex
CREATE INDEX "work_type_idx" ON "work"("type");

-- CreateIndex
CREATE INDEX "work_view_rule_idx" ON "work"("view_rule");

-- CreateIndex
CREATE INDEX "work_required_view_level_id_idx" ON "work"("required_view_level_id");

-- CreateIndex
CREATE INDEX "work_comment_count_idx" ON "work"("comment_count");

-- AddForeignKey
ALTER TABLE "admin_user_token" ADD CONSTRAINT "admin_user_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_agreement_log" ADD CONSTRAINT "app_agreement_log_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "app_agreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_agreement_log" ADD CONSTRAINT "app_agreement_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_announcement_read" ADD CONSTRAINT "app_announcement_read_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "app_announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_announcement_read" ADD CONSTRAINT "app_announcement_read_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_announcement" ADD CONSTRAINT "app_announcement_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "app_page"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_user_token" ADD CONSTRAINT "app_user_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "user_level_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignment" ADD CONSTRAINT "task_assignment_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignment" ADD CONSTRAINT "task_assignment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_progress_log" ADD CONSTRAINT "task_progress_log_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "task_assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_progress_log" ADD CONSTRAINT "task_progress_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "admin_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "admin_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badge_assignment" ADD CONSTRAINT "user_badge_assignment_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "user_badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badge_assignment" ADD CONSTRAINT "user_badge_assignment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_comment_like" ADD CONSTRAINT "user_comment_like_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "user_comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_comment_like" ADD CONSTRAINT "user_comment_like_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_comment_report" ADD CONSTRAINT "user_comment_report_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_comment_report" ADD CONSTRAINT "user_comment_report_handler_id_fkey" FOREIGN KEY ("handler_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_comment_report" ADD CONSTRAINT "user_comment_report_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "user_comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_comment" ADD CONSTRAINT "user_comment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_comment" ADD CONSTRAINT "user_comment_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "user_comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_comment" ADD CONSTRAINT "user_comment_actual_reply_to_id_fkey" FOREIGN KEY ("actual_reply_to_id") REFERENCES "user_comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_download_record" ADD CONSTRAINT "user_download_record_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_experience_record" ADD CONSTRAINT "user_experience_record_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "user_experience_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_experience_record" ADD CONSTRAINT "user_experience_record_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "user_growth_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_experience_record" ADD CONSTRAINT "user_experience_record_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favorite" ADD CONSTRAINT "user_favorite_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_growth_event" ADD CONSTRAINT "user_growth_event_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_like" ADD CONSTRAINT "user_like_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_point_record" ADD CONSTRAINT "user_point_record_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "user_point_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_point_record" ADD CONSTRAINT "user_point_record_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "user_growth_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_point_record" ADD CONSTRAINT "user_point_record_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_point_record" ADD CONSTRAINT "user_point_record_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "user_purchase_record"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_purchase_record" ADD CONSTRAINT "user_purchase_record_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_view" ADD CONSTRAINT "user_view_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_config_history" ADD CONSTRAINT "forum_config_history_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "forum_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_config_history" ADD CONSTRAINT "forum_config_history_operated_by_id_fkey" FOREIGN KEY ("operated_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_config" ADD CONSTRAINT "forum_config_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_moderator_action_log" ADD CONSTRAINT "forum_moderator_action_log_moderator_id_fkey" FOREIGN KEY ("moderator_id") REFERENCES "forum_moderator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_moderator_application" ADD CONSTRAINT "forum_moderator_application_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_moderator_application" ADD CONSTRAINT "forum_moderator_application_audit_by_id_fkey" FOREIGN KEY ("audit_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_moderator_application" ADD CONSTRAINT "forum_moderator_application_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "forum_section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_moderator_section" ADD CONSTRAINT "forum_moderator_section_moderator_id_fkey" FOREIGN KEY ("moderator_id") REFERENCES "forum_moderator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_moderator_section" ADD CONSTRAINT "forum_moderator_section_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "forum_section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_moderator" ADD CONSTRAINT "forum_moderator_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_moderator" ADD CONSTRAINT "forum_moderator_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "forum_section_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_notification" ADD CONSTRAINT "forum_notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_notification" ADD CONSTRAINT "forum_notification_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "forum_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_notification" ADD CONSTRAINT "forum_notification_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "forum_reply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_profile" ADD CONSTRAINT "forum_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reply_like" ADD CONSTRAINT "forum_reply_like_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "forum_reply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reply_like" ADD CONSTRAINT "forum_reply_like_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reply" ADD CONSTRAINT "forum_reply_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "forum_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reply" ADD CONSTRAINT "forum_reply_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reply" ADD CONSTRAINT "forum_reply_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "forum_reply"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reply" ADD CONSTRAINT "forum_reply_actual_reply_to_id_fkey" FOREIGN KEY ("actual_reply_to_id") REFERENCES "forum_reply"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_report" ADD CONSTRAINT "forum_report_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_report" ADD CONSTRAINT "forum_report_handler_id_fkey" FOREIGN KEY ("handler_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_section" ADD CONSTRAINT "forum_section_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "forum_section_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_section" ADD CONSTRAINT "forum_section_user_level_rule_id_fkey" FOREIGN KEY ("user_level_rule_id") REFERENCES "user_level_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_section" ADD CONSTRAINT "forum_section_last_topic_id_fkey" FOREIGN KEY ("last_topic_id") REFERENCES "forum_topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic_tag" ADD CONSTRAINT "forum_topic_tag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "forum_tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic_tag" ADD CONSTRAINT "forum_topic_tag_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "forum_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic" ADD CONSTRAINT "forum_topic_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "forum_section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic" ADD CONSTRAINT "forum_topic_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic" ADD CONSTRAINT "forum_topic_last_reply_user_id_fkey" FOREIGN KEY ("last_reply_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_user_action_log" ADD CONSTRAINT "forum_user_action_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_config" ADD CONSTRAINT "sys_config_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_dictionary_item" ADD CONSTRAINT "sys_dictionary_item_dictionary_code_fkey" FOREIGN KEY ("dictionary_code") REFERENCES "sys_dictionary"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic" ADD CONSTRAINT "work_comic_workId_fkey" FOREIGN KEY ("workId") REFERENCES "work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_novel" ADD CONSTRAINT "work_novel_workId_fkey" FOREIGN KEY ("workId") REFERENCES "work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_author_relation" ADD CONSTRAINT "work_author_relation_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_author_relation" ADD CONSTRAINT "work_author_relation_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "work_author"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_category_relation" ADD CONSTRAINT "work_category_relation_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_category_relation" ADD CONSTRAINT "work_category_relation_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "work_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_chapter" ADD CONSTRAINT "work_chapter_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_chapter" ADD CONSTRAINT "work_chapter_required_read_level_id_fkey" FOREIGN KEY ("required_read_level_id") REFERENCES "user_level_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comment_report" ADD CONSTRAINT "work_comment_report_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "work_comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comment_report" ADD CONSTRAINT "work_comment_report_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comment_report" ADD CONSTRAINT "work_comment_report_handler_id_fkey" FOREIGN KEY ("handler_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comment" ADD CONSTRAINT "work_comment_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comment" ADD CONSTRAINT "work_comment_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "work_chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comment" ADD CONSTRAINT "work_comment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comment" ADD CONSTRAINT "work_comment_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "work_comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comment" ADD CONSTRAINT "work_comment_actual_reply_to_id_fkey" FOREIGN KEY ("actual_reply_to_id") REFERENCES "work_comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tag_relation" ADD CONSTRAINT "work_tag_relation_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tag_relation" ADD CONSTRAINT "work_tag_relation_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "work_tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work" ADD CONSTRAINT "work_required_view_level_id_fkey" FOREIGN KEY ("required_view_level_id") REFERENCES "user_level_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
