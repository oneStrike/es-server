-- AlterTable
ALTER TABLE "forum_topic" ALTER COLUMN "audit_status" SET DEFAULT 1;

-- CreateTable
CREATE TABLE "forum_config_history" (
    "id" SERIAL NOT NULL,
    "config_id" INTEGER NOT NULL,
    "changes" JSONB NOT NULL,
    "change_type" VARCHAR(20) NOT NULL,
    "reason" VARCHAR(500),
    "operated_by_id" INTEGER,
    "operated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(50),
    "user_agent" VARCHAR(500),

    CONSTRAINT "forum_config_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_config" (
    "id" SERIAL NOT NULL,
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
    "topic_review_policy" INTEGER NOT NULL DEFAULT 1,
    "reply_review_policy" INTEGER NOT NULL DEFAULT 1,
    "allow_anonymous_view" BOOLEAN NOT NULL DEFAULT true,
    "allow_anonymous_post" BOOLEAN NOT NULL DEFAULT false,
    "allow_anonymous_reply" BOOLEAN NOT NULL DEFAULT false,
    "new_user_post_limit_hours" INTEGER NOT NULL DEFAULT 24,
    "daily_post_limit" INTEGER NOT NULL DEFAULT 50,
    "daily_reply_limit" INTEGER NOT NULL DEFAULT 100,
    "allow_user_register" BOOLEAN NOT NULL DEFAULT true,
    "register_require_email_verify" BOOLEAN NOT NULL DEFAULT true,
    "register_require_phone_verify" BOOLEAN NOT NULL DEFAULT false,
    "username_min_length" INTEGER NOT NULL DEFAULT 3,
    "username_max_length" INTEGER NOT NULL DEFAULT 20,
    "password_min_length" INTEGER NOT NULL DEFAULT 8,
    "password_require_number" BOOLEAN NOT NULL DEFAULT true,
    "password_require_uppercase" BOOLEAN NOT NULL DEFAULT false,
    "password_require_special_char" BOOLEAN NOT NULL DEFAULT false,
    "signature_max_length" INTEGER NOT NULL DEFAULT 200,
    "bio_max_length" INTEGER NOT NULL DEFAULT 500,
    "post_topic_points" INTEGER NOT NULL DEFAULT 10,
    "post_reply_points" INTEGER NOT NULL DEFAULT 5,
    "topic_liked_points" INTEGER NOT NULL DEFAULT 2,
    "reply_liked_points" INTEGER NOT NULL DEFAULT 1,
    "topic_favorited_points" INTEGER NOT NULL DEFAULT 3,
    "daily_check_in_points" INTEGER NOT NULL DEFAULT 5,
    "delete_topic_points" INTEGER NOT NULL DEFAULT -10,
    "delete_reply_points" INTEGER NOT NULL DEFAULT -5,
    "enable_email_notification" BOOLEAN NOT NULL DEFAULT true,
    "enable_in_app_notification" BOOLEAN NOT NULL DEFAULT true,
    "enable_new_topic_notification" BOOLEAN NOT NULL DEFAULT true,
    "enable_new_reply_notification" BOOLEAN NOT NULL DEFAULT true,
    "enable_like_notification" BOOLEAN NOT NULL DEFAULT true,
    "enable_favorite_notification" BOOLEAN NOT NULL DEFAULT true,
    "enable_system_notification" BOOLEAN NOT NULL DEFAULT true,
    "enable_captcha" BOOLEAN NOT NULL DEFAULT true,
    "captcha_type" INTEGER NOT NULL DEFAULT 0,
    "login_fail_lock_count" INTEGER NOT NULL DEFAULT 5,
    "login_fail_lock_minutes" INTEGER NOT NULL DEFAULT 30,
    "ip_rate_limit_per_minute" INTEGER NOT NULL DEFAULT 60,
    "enable_sensitive_word_filter" BOOLEAN NOT NULL DEFAULT true,
    "sensitive_word_replace_char" TEXT NOT NULL DEFAULT '*',
    "enable_maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "maintenance_message" VARCHAR(500),
    "enable_statistics" BOOLEAN NOT NULL DEFAULT true,
    "statistics_retention_days" INTEGER NOT NULL DEFAULT 90,
    "enable_search" BOOLEAN NOT NULL DEFAULT true,
    "search_page_size" INTEGER NOT NULL DEFAULT 20,
    "enable_tags" BOOLEAN NOT NULL DEFAULT true,
    "max_tags_per_topic" INTEGER NOT NULL DEFAULT 5,
    "updated_by_id" INTEGER,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_config_pkey" PRIMARY KEY ("id")
);

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

-- AddForeignKey
ALTER TABLE "forum_config_history" ADD CONSTRAINT "forum_config_history_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "forum_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_config_history" ADD CONSTRAINT "forum_config_history_operated_by_id_fkey" FOREIGN KEY ("operated_by_id") REFERENCES "forum_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_config" ADD CONSTRAINT "forum_config_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "forum_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
