-- CreateTable
CREATE TABLE "admin_user" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(20) NOT NULL,
    "password" VARCHAR(500) NOT NULL,
    "avatar" VARCHAR(200),
    "mobile" VARCHAR(11),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "role" SMALLINT NOT NULL DEFAULT 0,
    "last_login_at" TIMESTAMPTZ(6),
    "last_login_ip" VARCHAR(45),
    "login_fail_at" TIMESTAMPTZ(6),
    "login_fail_ip" VARCHAR(45),
    "login_fail_count" INTEGER NOT NULL DEFAULT 0,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "admin_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_config" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "client_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_notice" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "content" TEXT NOT NULL,
    "notice_type" SMALLINT NOT NULL DEFAULT 0,
    "priority_level" SMALLINT NOT NULL DEFAULT 1,
    "publish_start_time" TIMESTAMPTZ(6),
    "publish_end_time" TIMESTAMPTZ(6),
    "page_id" INTEGER,
    "popup_background_image" VARCHAR(200),
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "show_as_popup" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "enable_platform" INTEGER[],

    CONSTRAINT "client_notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_page" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "path" VARCHAR(300) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "access_level" SMALLINT NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "enable_platform" INTEGER[],

    CONSTRAINT "client_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_user" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "nickname" VARCHAR(100),
    "avatar_url" VARCHAR(500),
    "phone_number" VARCHAR(20),
    "email_address" VARCHAR(255),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "gender_type" SMALLINT NOT NULL DEFAULT 0,
    "birth_date" DATE,
    "is_signed_in" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMPTZ,
    "last_login_ip" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "client_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_audit_log" (
    "id" SERIAL NOT NULL,
    "object_type" SMALLINT NOT NULL,
    "object_id" INTEGER NOT NULL,
    "audit_status" SMALLINT NOT NULL,
    "audit_reason" VARCHAR(500),
    "audit_by" INTEGER NOT NULL,
    "audit_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remark" VARCHAR(500),

    CONSTRAINT "forum_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_badge" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "description" VARCHAR(200),
    "icon" VARCHAR(255),
    "type" SMALLINT NOT NULL,
    "order" SMALLINT NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "forum_badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_level_rule" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "description" VARCHAR(200),
    "icon" VARCHAR(255),
    "required_points" INTEGER NOT NULL,
    "order" SMALLINT NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "daily_topic_limit" SMALLINT NOT NULL DEFAULT 0,
    "daily_reply_limit" SMALLINT NOT NULL DEFAULT 0,
    "post_interval" SMALLINT NOT NULL DEFAULT 0,
    "max_file_size" SMALLINT NOT NULL DEFAULT 0,
    "daily_like_limit" SMALLINT NOT NULL DEFAULT 0,
    "daily_favorite_limit" SMALLINT NOT NULL DEFAULT 0,
    "daily_comment_limit" SMALLINT NOT NULL DEFAULT 0,
    "level_color" VARCHAR(20),
    "level_badge" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "forum_level_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_moderator_action_log" (
    "id" SERIAL NOT NULL,
    "moderator_id" INTEGER NOT NULL,
    "action_type" SMALLINT NOT NULL,
    "action_description" VARCHAR(200) NOT NULL,
    "target_type" SMALLINT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "before_data" TEXT,
    "after_data" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_moderator_action_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_moderator_section" (
    "id" SERIAL NOT NULL,
    "moderator_id" INTEGER NOT NULL,
    "section_id" INTEGER NOT NULL,
    "inherit_from_parent" BOOLEAN NOT NULL DEFAULT true,
    "custom_permission_mask" INTEGER NOT NULL DEFAULT 0,
    "final_permission_mask" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "forum_moderator_section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_moderator" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "permission" INTEGER NOT NULL DEFAULT 0,
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
    "type" SMALLINT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" VARCHAR(1000) NOT NULL,
    "priority" SMALLINT NOT NULL DEFAULT 1,
    "topic_id" INTEGER,
    "reply_id" INTEGER,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expired_at" TIMESTAMPTZ(6),

    CONSTRAINT "forum_notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_point_record" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "rule_id" INTEGER,
    "points" INTEGER NOT NULL,
    "before_points" INTEGER NOT NULL,
    "after_points" INTEGER NOT NULL,
    "remark" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_point_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_point_rule" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "type" SMALLINT NOT NULL,
    "points" INTEGER NOT NULL,
    "daily_limit" INTEGER NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "remark" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "forum_point_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_profile_badge" (
    "id" SERIAL NOT NULL,
    "profile_id" INTEGER NOT NULL,
    "badge_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_profile_badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_profile" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "level_id" INTEGER NOT NULL,
    "topic_count" INTEGER NOT NULL DEFAULT 0,
    "reply_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "favorite_count" INTEGER NOT NULL DEFAULT 0,
    "signature" VARCHAR(200),
    "bio" VARCHAR(500),
    "status" INTEGER NOT NULL DEFAULT 1,
    "ban_reason" VARCHAR(500),
    "ban_until" TIMESTAMPTZ(6),
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
    "content" TEXT NOT NULL,
    "topic_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "floor" INTEGER NOT NULL,
    "reply_to_id" INTEGER,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "audit_status" SMALLINT NOT NULL DEFAULT 0,
    "audit_reason" VARCHAR(500),
    "audit_at" TIMESTAMPTZ(6),
    "audit_by" INTEGER,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "forum_reply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_section" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "parent_id" INTEGER,
    "level" INTEGER NOT NULL DEFAULT 0,
    "path" VARCHAR(200),
    "inherit_permission" BOOLEAN NOT NULL DEFAULT true,
    "icon" VARCHAR(255),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "topic_review_policy" INTEGER NOT NULL DEFAULT 1,
    "user_level_rule_id" INTEGER,
    "topic_count" INTEGER NOT NULL DEFAULT 0,
    "reply_count" INTEGER NOT NULL DEFAULT 0,
    "last_post_at" TIMESTAMPTZ(6),
    "last_topic_id" INTEGER,
    "description" VARCHAR(500),
    "remark" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "forum_section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_sensitive_word" (
    "id" SERIAL NOT NULL,
    "word" VARCHAR(100) NOT NULL,
    "replace_word" VARCHAR(100),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "remark" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "level" SMALLINT NOT NULL DEFAULT 2,
    "matchMode" SMALLINT NOT NULL DEFAULT 1,
    "type" SMALLINT NOT NULL DEFAULT 5,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "forum_sensitive_word_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_tag" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "icon" VARCHAR(255),
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "order" SMALLINT NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" VARCHAR(200),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "forum_tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_topic_favorite" (
    "id" SERIAL NOT NULL,
    "topic_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_topic_favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_topic_like" (
    "id" SERIAL NOT NULL,
    "topic_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_topic_like_pkey" PRIMARY KEY ("id")
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
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "section_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "audit_status" SMALLINT NOT NULL DEFAULT 0,
    "audit_reason" VARCHAR(500),
    "audit_at" TIMESTAMPTZ(6),
    "audit_by" INTEGER,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "reply_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "favorite_count" INTEGER NOT NULL DEFAULT 0,
    "last_reply_at" TIMESTAMPTZ(6),
    "last_reply_user_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "forum_topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_user_action_log" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "action_type" SMALLINT NOT NULL,
    "action_description" VARCHAR(200) NOT NULL,
    "target_type" SMALLINT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "before_data" TEXT,
    "after_data" TEXT,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_user_action_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_level" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "points" INTEGER NOT NULL,
    "login_days" SMALLINT NOT NULL DEFAULT 0,
    "icon" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "color" VARCHAR(20),
    "blacklist_limit" SMALLINT NOT NULL DEFAULT 10,
    "work_collection_limit" SMALLINT NOT NULL DEFAULT 100,
    "discount" REAL NOT NULL DEFAULT 0.0,
    "remark" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "level" SMALLINT NOT NULL DEFAULT 1,

    CONSTRAINT "member_level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_log" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "username" TEXT,
    "api_type" VARCHAR(20),
    "ip" VARCHAR(45),
    "method" VARCHAR(10) NOT NULL,
    "path" VARCHAR(255) NOT NULL,
    "params" JSONB,
    "action_type" VARCHAR(50),
    "is_success" BOOLEAN NOT NULL,
    "user_agent" VARCHAR(255),
    "device" JSONB,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "request_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dictionary" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "cover" VARCHAR(200),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "dictionary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dictionary_item" (
    "id" SERIAL NOT NULL,
    "dictionary_code" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "order" SMALLSERIAL,
    "cover" VARCHAR(200),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "dictionary_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_author" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "avatar" VARCHAR(500),
    "description" VARCHAR(1000),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "nationality" VARCHAR(50),
    "gender" SMALLINT NOT NULL DEFAULT 0,
    "works_count" INTEGER NOT NULL DEFAULT 0,
    "followers_count" INTEGER NOT NULL DEFAULT 0,
    "remark" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "is_recommended" BOOLEAN NOT NULL DEFAULT false,
    "type" INTEGER[],

    CONSTRAINT "work_author_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_comic_author" (
    "id" SERIAL NOT NULL,
    "comic_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "work_comic_author_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_comic_category" (
    "comic_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "work_comic_category_pkey" PRIMARY KEY ("comic_id","category_id")
);

-- CreateTable
CREATE TABLE "work_comic_chapter" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "subtitle" VARCHAR(200),
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "comic_id" INTEGER NOT NULL,
    "read_rule" SMALLINT NOT NULL DEFAULT 0,
    "contents" TEXT NOT NULL DEFAULT '[]',
    "is_preview" BOOLEAN NOT NULL DEFAULT false,
    "publish_at" TIMESTAMPTZ(6),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "remark" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "can_comment" BOOLEAN NOT NULL DEFAULT true,
    "download_points" INTEGER DEFAULT 0,
    "read_points" INTEGER DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "download_rule" SMALLINT NOT NULL DEFAULT 1,
    "required_download_level_id" INTEGER,
    "required_read_level_id" INTEGER,
    "description" VARCHAR(1000),
    "purchase_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "work_comic_chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_comic_tag" (
    "comic_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "work_comic_tag_pkey" PRIMARY KEY ("comic_id","tag_id")
);

-- CreateTable
CREATE TABLE "work_comic" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "alias" VARCHAR(200),
    "cover" VARCHAR(500) NOT NULL,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "popularity_weight" INTEGER NOT NULL DEFAULT 0,
    "language" VARCHAR(10) NOT NULL,
    "region" VARCHAR(10) NOT NULL,
    "age_rating" VARCHAR(10),
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "publish_at" DATE,
    "last_updated" TIMESTAMPTZ(6),
    "description" TEXT NOT NULL,
    "publisher" VARCHAR(100),
    "original_source" VARCHAR(100),
    "serial_status" SMALLINT NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION,
    "recommend_weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "is_recommended" BOOLEAN NOT NULL DEFAULT false,
    "is_hot" BOOLEAN NOT NULL DEFAULT false,
    "is_new" BOOLEAN NOT NULL DEFAULT false,
    "copyright" VARCHAR(500),
    "disclaimer" TEXT,
    "remark" VARCHAR(1000),
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "favorite_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "view_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "work_comic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_category" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "icon" VARCHAR(255),
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "popularity_weight" INTEGER NOT NULL DEFAULT 0,
    "order" SMALLINT NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "description" VARCHAR(200),
    "content_type" INTEGER[],

    CONSTRAINT "work_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_tag" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "icon" VARCHAR(255),
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "popularity_weight" INTEGER NOT NULL DEFAULT 0,
    "order" SMALLINT NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "description" VARCHAR(200),

    CONSTRAINT "work_tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TopicTags" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_TopicTags_AB_pkey" PRIMARY KEY ("A","B")
);

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
CREATE INDEX "admin_user_is_locked_idx" ON "admin_user"("is_locked");

-- CreateIndex
CREATE INDEX "client_notice_is_published_publish_start_time_publish_end_t_idx" ON "client_notice"("is_published", "publish_start_time", "publish_end_time");

-- CreateIndex
CREATE INDEX "client_notice_notice_type_is_published_idx" ON "client_notice"("notice_type", "is_published");

-- CreateIndex
CREATE INDEX "client_notice_priority_level_is_pinned_idx" ON "client_notice"("priority_level", "is_pinned");

-- CreateIndex
CREATE INDEX "client_notice_created_at_idx" ON "client_notice"("created_at");

-- CreateIndex
CREATE INDEX "client_notice_page_id_idx" ON "client_notice"("page_id");

-- CreateIndex
CREATE INDEX "client_notice_show_as_popup_is_published_idx" ON "client_notice"("show_as_popup", "is_published");

-- CreateIndex
CREATE UNIQUE INDEX "client_page_code_key" ON "client_page"("code");

-- CreateIndex
CREATE UNIQUE INDEX "client_page_path_key" ON "client_page"("path");

-- CreateIndex
CREATE INDEX "client_page_access_level_is_enabled_idx" ON "client_page"("access_level", "is_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "client_user_username_key" ON "client_user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "client_user_phone_number_key" ON "client_user"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "client_user_email_address_key" ON "client_user"("email_address");

-- CreateIndex
CREATE INDEX "client_user_is_enabled_idx" ON "client_user"("is_enabled");

-- CreateIndex
CREATE INDEX "client_user_gender_type_idx" ON "client_user"("gender_type");

-- CreateIndex
CREATE INDEX "client_user_created_at_idx" ON "client_user"("created_at");

-- CreateIndex
CREATE INDEX "client_user_last_login_at_idx" ON "client_user"("last_login_at");

-- CreateIndex
CREATE INDEX "client_user_phone_number_idx" ON "client_user"("phone_number");

-- CreateIndex
CREATE INDEX "client_user_email_address_idx" ON "client_user"("email_address");

-- CreateIndex
CREATE INDEX "forum_audit_log_object_type_object_id_idx" ON "forum_audit_log"("object_type", "object_id");

-- CreateIndex
CREATE INDEX "forum_audit_log_audit_status_idx" ON "forum_audit_log"("audit_status");

-- CreateIndex
CREATE INDEX "forum_audit_log_audit_by_idx" ON "forum_audit_log"("audit_by");

-- CreateIndex
CREATE INDEX "forum_audit_log_audit_at_idx" ON "forum_audit_log"("audit_at");

-- CreateIndex
CREATE INDEX "forum_badge_type_idx" ON "forum_badge"("type");

-- CreateIndex
CREATE INDEX "forum_badge_order_idx" ON "forum_badge"("order");

-- CreateIndex
CREATE INDEX "forum_badge_is_enabled_idx" ON "forum_badge"("is_enabled");

-- CreateIndex
CREATE INDEX "forum_badge_created_at_idx" ON "forum_badge"("created_at");

-- CreateIndex
CREATE INDEX "forum_level_rule_is_enabled_order_idx" ON "forum_level_rule"("is_enabled", "order");

-- CreateIndex
CREATE INDEX "forum_level_rule_is_enabled_required_points_idx" ON "forum_level_rule"("is_enabled", "required_points");

-- CreateIndex
CREATE INDEX "forum_level_rule_created_at_idx" ON "forum_level_rule"("created_at");

-- CreateIndex
CREATE INDEX "forum_moderator_action_log_moderator_id_idx" ON "forum_moderator_action_log"("moderator_id");

-- CreateIndex
CREATE INDEX "forum_moderator_action_log_action_type_idx" ON "forum_moderator_action_log"("action_type");

-- CreateIndex
CREATE INDEX "forum_moderator_action_log_target_type_target_id_idx" ON "forum_moderator_action_log"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "forum_moderator_action_log_created_at_idx" ON "forum_moderator_action_log"("created_at");

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
CREATE INDEX "forum_moderator_permission_idx" ON "forum_moderator"("permission");

-- CreateIndex
CREATE INDEX "forum_moderator_is_enabled_idx" ON "forum_moderator"("is_enabled");

-- CreateIndex
CREATE INDEX "forum_moderator_created_at_idx" ON "forum_moderator"("created_at");

-- CreateIndex
CREATE INDEX "forum_moderator_deleted_at_idx" ON "forum_moderator"("deleted_at");

-- CreateIndex
CREATE INDEX "forum_notification_user_id_idx" ON "forum_notification"("user_id");

-- CreateIndex
CREATE INDEX "forum_notification_type_idx" ON "forum_notification"("type");

-- CreateIndex
CREATE INDEX "forum_notification_priority_idx" ON "forum_notification"("priority");

-- CreateIndex
CREATE INDEX "forum_notification_topic_id_idx" ON "forum_notification"("topic_id");

-- CreateIndex
CREATE INDEX "forum_notification_reply_id_idx" ON "forum_notification"("reply_id");

-- CreateIndex
CREATE INDEX "forum_notification_expired_at_idx" ON "forum_notification"("expired_at");

-- CreateIndex
CREATE INDEX "forum_notification_is_read_idx" ON "forum_notification"("is_read");

-- CreateIndex
CREATE INDEX "forum_notification_created_at_idx" ON "forum_notification"("created_at");

-- CreateIndex
CREATE INDEX "forum_notification_user_id_is_read_idx" ON "forum_notification"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "forum_notification_user_id_priority_idx" ON "forum_notification"("user_id", "priority");

-- CreateIndex
CREATE INDEX "forum_notification_user_id_created_at_idx" ON "forum_notification"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "forum_point_record_user_id_idx" ON "forum_point_record"("user_id");

-- CreateIndex
CREATE INDEX "forum_point_record_rule_id_idx" ON "forum_point_record"("rule_id");

-- CreateIndex
CREATE INDEX "forum_point_record_created_at_idx" ON "forum_point_record"("created_at");

-- CreateIndex
CREATE INDEX "forum_point_record_user_id_created_at_idx" ON "forum_point_record"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "forum_point_rule_name_key" ON "forum_point_rule"("name");

-- CreateIndex
CREATE UNIQUE INDEX "forum_point_rule_type_key" ON "forum_point_rule"("type");

-- CreateIndex
CREATE INDEX "forum_point_rule_type_idx" ON "forum_point_rule"("type");

-- CreateIndex
CREATE INDEX "forum_point_rule_is_enabled_idx" ON "forum_point_rule"("is_enabled");

-- CreateIndex
CREATE INDEX "forum_point_rule_created_at_idx" ON "forum_point_rule"("created_at");

-- CreateIndex
CREATE INDEX "forum_profile_badge_profile_id_idx" ON "forum_profile_badge"("profile_id");

-- CreateIndex
CREATE INDEX "forum_profile_badge_badge_id_idx" ON "forum_profile_badge"("badge_id");

-- CreateIndex
CREATE INDEX "forum_profile_badge_created_at_idx" ON "forum_profile_badge"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "forum_profile_badge_profile_id_badge_id_key" ON "forum_profile_badge"("profile_id", "badge_id");

-- CreateIndex
CREATE UNIQUE INDEX "forum_profile_user_id_key" ON "forum_profile"("user_id");

-- CreateIndex
CREATE INDEX "forum_profile_points_idx" ON "forum_profile"("points");

-- CreateIndex
CREATE INDEX "forum_profile_level_id_idx" ON "forum_profile"("level_id");

-- CreateIndex
CREATE INDEX "forum_profile_topic_count_idx" ON "forum_profile"("topic_count");

-- CreateIndex
CREATE INDEX "forum_profile_reply_count_idx" ON "forum_profile"("reply_count");

-- CreateIndex
CREATE INDEX "forum_profile_like_count_idx" ON "forum_profile"("like_count");

-- CreateIndex
CREATE INDEX "forum_profile_favorite_count_idx" ON "forum_profile"("favorite_count");

-- CreateIndex
CREATE INDEX "forum_profile_status_idx" ON "forum_profile"("status");

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
CREATE INDEX "forum_reply_floor_idx" ON "forum_reply"("floor");

-- CreateIndex
CREATE INDEX "forum_reply_reply_to_id_idx" ON "forum_reply"("reply_to_id");

-- CreateIndex
CREATE INDEX "forum_reply_is_hidden_idx" ON "forum_reply"("is_hidden");

-- CreateIndex
CREATE INDEX "forum_reply_audit_status_idx" ON "forum_reply"("audit_status");

-- CreateIndex
CREATE INDEX "forum_reply_like_count_idx" ON "forum_reply"("like_count");

-- CreateIndex
CREATE INDEX "forum_reply_created_at_idx" ON "forum_reply"("created_at");

-- CreateIndex
CREATE INDEX "forum_reply_updated_at_idx" ON "forum_reply"("updated_at");

-- CreateIndex
CREATE INDEX "forum_reply_deleted_at_idx" ON "forum_reply"("deleted_at");

-- CreateIndex
CREATE INDEX "forum_reply_topic_id_floor_idx" ON "forum_reply"("topic_id", "floor");

-- CreateIndex
CREATE INDEX "forum_reply_topic_id_created_at_idx" ON "forum_reply"("topic_id", "created_at");

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
CREATE INDEX "forum_section_parent_id_idx" ON "forum_section"("parent_id");

-- CreateIndex
CREATE INDEX "forum_section_level_idx" ON "forum_section"("level");

-- CreateIndex
CREATE UNIQUE INDEX "forum_sensitive_word_word_key" ON "forum_sensitive_word"("word");

-- CreateIndex
CREATE INDEX "forum_sensitive_word_word_idx" ON "forum_sensitive_word"("word");

-- CreateIndex
CREATE INDEX "forum_sensitive_word_type_idx" ON "forum_sensitive_word"("type");

-- CreateIndex
CREATE INDEX "forum_sensitive_word_level_idx" ON "forum_sensitive_word"("level");

-- CreateIndex
CREATE INDEX "forum_sensitive_word_matchMode_idx" ON "forum_sensitive_word"("matchMode");

-- CreateIndex
CREATE INDEX "forum_sensitive_word_is_enabled_idx" ON "forum_sensitive_word"("is_enabled");

-- CreateIndex
CREATE INDEX "forum_sensitive_word_created_at_idx" ON "forum_sensitive_word"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "forum_tag_name_key" ON "forum_tag"("name");

-- CreateIndex
CREATE INDEX "forum_tag_order_idx" ON "forum_tag"("order");

-- CreateIndex
CREATE INDEX "forum_tag_name_idx" ON "forum_tag"("name");

-- CreateIndex
CREATE INDEX "forum_tag_is_enabled_idx" ON "forum_tag"("is_enabled");

-- CreateIndex
CREATE INDEX "forum_tag_use_count_idx" ON "forum_tag"("use_count");

-- CreateIndex
CREATE INDEX "forum_tag_created_at_idx" ON "forum_tag"("created_at");

-- CreateIndex
CREATE INDEX "forum_topic_favorite_topic_id_idx" ON "forum_topic_favorite"("topic_id");

-- CreateIndex
CREATE INDEX "forum_topic_favorite_user_id_idx" ON "forum_topic_favorite"("user_id");

-- CreateIndex
CREATE INDEX "forum_topic_favorite_created_at_idx" ON "forum_topic_favorite"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "forum_topic_favorite_topic_id_user_id_key" ON "forum_topic_favorite"("topic_id", "user_id");

-- CreateIndex
CREATE INDEX "forum_topic_like_topic_id_idx" ON "forum_topic_like"("topic_id");

-- CreateIndex
CREATE INDEX "forum_topic_like_user_id_idx" ON "forum_topic_like"("user_id");

-- CreateIndex
CREATE INDEX "forum_topic_like_created_at_idx" ON "forum_topic_like"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "forum_topic_like_topic_id_user_id_key" ON "forum_topic_like"("topic_id", "user_id");

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
CREATE INDEX "member_level_points_idx" ON "member_level"("points");

-- CreateIndex
CREATE INDEX "member_level_is_enabled_idx" ON "member_level"("is_enabled");

-- CreateIndex
CREATE INDEX "member_level_created_at_idx" ON "member_level"("created_at");

-- CreateIndex
CREATE INDEX "member_level_level_idx" ON "member_level"("level");

-- CreateIndex
CREATE INDEX "request_log_created_at_idx" ON "request_log"("created_at");

-- CreateIndex
CREATE INDEX "request_log_user_id_idx" ON "request_log"("user_id");

-- CreateIndex
CREATE INDEX "request_log_username_idx" ON "request_log"("username");

-- CreateIndex
CREATE INDEX "request_log_is_success_idx" ON "request_log"("is_success");

-- CreateIndex
CREATE UNIQUE INDEX "dictionary_name_key" ON "dictionary"("name");

-- CreateIndex
CREATE UNIQUE INDEX "dictionary_code_key" ON "dictionary"("code");

-- CreateIndex
CREATE INDEX "dictionary_item_dictionary_code_idx" ON "dictionary_item"("dictionary_code");

-- CreateIndex
CREATE INDEX "dictionary_item_order_idx" ON "dictionary_item"("order");

-- CreateIndex
CREATE UNIQUE INDEX "dictionary_item_dictionary_code_code_key" ON "dictionary_item"("dictionary_code", "code");

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
CREATE INDEX "work_author_is_recommended_works_count_idx" ON "work_author"("is_recommended", "works_count" DESC);

-- CreateIndex
CREATE INDEX "work_author_created_at_idx" ON "work_author"("created_at");

-- CreateIndex
CREATE INDEX "work_comic_author_comic_id_idx" ON "work_comic_author"("comic_id");

-- CreateIndex
CREATE INDEX "work_comic_author_author_id_idx" ON "work_comic_author"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_comic_author_comic_id_author_id_key" ON "work_comic_author"("comic_id", "author_id");

-- CreateIndex
CREATE INDEX "work_comic_category_category_id_idx" ON "work_comic_category"("category_id");

-- CreateIndex
CREATE INDEX "work_comic_category_sort_order_idx" ON "work_comic_category"("sort_order");

-- CreateIndex
CREATE INDEX "work_comic_category_comic_id_sort_order_idx" ON "work_comic_category"("comic_id", "sort_order");

-- CreateIndex
CREATE INDEX "work_comic_chapter_comic_id_idx" ON "work_comic_chapter"("comic_id");

-- CreateIndex
CREATE INDEX "work_comic_chapter_comic_id_sort_order_idx" ON "work_comic_chapter"("comic_id", "sort_order");

-- CreateIndex
CREATE INDEX "work_comic_chapter_is_published_publish_at_idx" ON "work_comic_chapter"("is_published", "publish_at");

-- CreateIndex
CREATE INDEX "work_comic_chapter_read_rule_idx" ON "work_comic_chapter"("read_rule");

-- CreateIndex
CREATE INDEX "work_comic_chapter_is_preview_idx" ON "work_comic_chapter"("is_preview");

-- CreateIndex
CREATE INDEX "work_comic_chapter_view_count_idx" ON "work_comic_chapter"("view_count");

-- CreateIndex
CREATE INDEX "work_comic_chapter_like_count_idx" ON "work_comic_chapter"("like_count");

-- CreateIndex
CREATE INDEX "work_comic_chapter_created_at_idx" ON "work_comic_chapter"("created_at");

-- CreateIndex
CREATE INDEX "work_comic_chapter_publish_at_idx" ON "work_comic_chapter"("publish_at");

-- CreateIndex
CREATE INDEX "work_comic_chapter_required_read_level_id_idx" ON "work_comic_chapter"("required_read_level_id");

-- CreateIndex
CREATE INDEX "work_comic_chapter_required_download_level_id_idx" ON "work_comic_chapter"("required_download_level_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_comic_chapter_comic_id_sort_order_key" ON "work_comic_chapter"("comic_id", "sort_order");

-- CreateIndex
CREATE INDEX "work_comic_tag_tag_id_idx" ON "work_comic_tag"("tag_id");

-- CreateIndex
CREATE INDEX "work_comic_tag_comic_id_idx" ON "work_comic_tag"("comic_id");

-- CreateIndex
CREATE INDEX "work_comic_tag_sort_order_idx" ON "work_comic_tag"("sort_order");

-- CreateIndex
CREATE INDEX "work_comic_tag_comic_id_sort_order_idx" ON "work_comic_tag"("comic_id", "sort_order");

-- CreateIndex
CREATE INDEX "work_comic_is_published_publish_at_idx" ON "work_comic"("is_published", "publish_at");

-- CreateIndex
CREATE INDEX "work_comic_popularity_popularity_weight_idx" ON "work_comic"("popularity", "popularity_weight");

-- CreateIndex
CREATE INDEX "work_comic_language_region_idx" ON "work_comic"("language", "region");

-- CreateIndex
CREATE INDEX "work_comic_serial_status_idx" ON "work_comic"("serial_status");

-- CreateIndex
CREATE INDEX "work_comic_last_updated_idx" ON "work_comic"("last_updated");

-- CreateIndex
CREATE INDEX "work_comic_name_idx" ON "work_comic"("name");

-- CreateIndex
CREATE INDEX "work_comic_age_rating_idx" ON "work_comic"("age_rating");

-- CreateIndex
CREATE INDEX "work_comic_rating_idx" ON "work_comic"("rating");

-- CreateIndex
CREATE INDEX "work_comic_is_recommended_idx" ON "work_comic"("is_recommended");

-- CreateIndex
CREATE INDEX "work_comic_is_hot_is_new_idx" ON "work_comic"("is_hot", "is_new");

-- CreateIndex
CREATE INDEX "work_comic_is_published_is_recommended_idx" ON "work_comic"("is_published", "is_recommended");

-- CreateIndex
CREATE INDEX "work_comic_is_published_serial_status_last_updated_idx" ON "work_comic"("is_published", "serial_status", "last_updated");

-- CreateIndex
CREATE INDEX "work_comic_created_at_idx" ON "work_comic"("created_at");

-- CreateIndex
CREATE INDEX "work_comic_deleted_at_idx" ON "work_comic"("deleted_at");

-- CreateIndex
CREATE INDEX "work_comic_like_count_idx" ON "work_comic"("like_count");

-- CreateIndex
CREATE INDEX "work_comic_favorite_count_idx" ON "work_comic"("favorite_count");

-- CreateIndex
CREATE INDEX "work_comic_view_count_idx" ON "work_comic"("view_count");

-- CreateIndex
CREATE UNIQUE INDEX "work_category_name_key" ON "work_category"("name");

-- CreateIndex
CREATE INDEX "work_category_order_idx" ON "work_category"("order");

-- CreateIndex
CREATE INDEX "work_category_name_idx" ON "work_category"("name");

-- CreateIndex
CREATE INDEX "work_category_content_type_idx" ON "work_category"("content_type");

-- CreateIndex
CREATE UNIQUE INDEX "work_tag_name_key" ON "work_tag"("name");

-- CreateIndex
CREATE INDEX "work_tag_order_idx" ON "work_tag"("order");

-- CreateIndex
CREATE INDEX "work_tag_name_idx" ON "work_tag"("name");

-- CreateIndex
CREATE INDEX "work_tag_is_enabled_idx" ON "work_tag"("is_enabled");

-- CreateIndex
CREATE INDEX "_TopicTags_B_index" ON "_TopicTags"("B");

-- AddForeignKey
ALTER TABLE "client_notice" ADD CONSTRAINT "client_notice_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "client_page"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_moderator_action_log" ADD CONSTRAINT "forum_moderator_action_log_moderator_id_fkey" FOREIGN KEY ("moderator_id") REFERENCES "forum_moderator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_moderator_section" ADD CONSTRAINT "forum_moderator_section_moderator_id_fkey" FOREIGN KEY ("moderator_id") REFERENCES "forum_moderator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_moderator_section" ADD CONSTRAINT "forum_moderator_section_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "forum_section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_moderator" ADD CONSTRAINT "forum_moderator_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "forum_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_notification" ADD CONSTRAINT "forum_notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "forum_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_notification" ADD CONSTRAINT "forum_notification_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "forum_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_notification" ADD CONSTRAINT "forum_notification_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "forum_reply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_point_record" ADD CONSTRAINT "forum_point_record_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "forum_point_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_point_record" ADD CONSTRAINT "forum_point_record_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "forum_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_profile_badge" ADD CONSTRAINT "forum_profile_badge_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "forum_badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_profile_badge" ADD CONSTRAINT "forum_profile_badge_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "forum_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_profile" ADD CONSTRAINT "forum_profile_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "forum_level_rule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_profile" ADD CONSTRAINT "forum_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "client_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reply_like" ADD CONSTRAINT "forum_reply_like_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "forum_reply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reply_like" ADD CONSTRAINT "forum_reply_like_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "forum_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reply" ADD CONSTRAINT "forum_reply_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "forum_reply"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reply" ADD CONSTRAINT "forum_reply_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "forum_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reply" ADD CONSTRAINT "forum_reply_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "client_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_section" ADD CONSTRAINT "forum_section_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "forum_section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_section" ADD CONSTRAINT "forum_section_last_topic_id_fkey" FOREIGN KEY ("last_topic_id") REFERENCES "forum_topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_section" ADD CONSTRAINT "forum_section_user_level_rule_id_fkey" FOREIGN KEY ("user_level_rule_id") REFERENCES "forum_level_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic_favorite" ADD CONSTRAINT "forum_topic_favorite_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "forum_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic_favorite" ADD CONSTRAINT "forum_topic_favorite_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "forum_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic_like" ADD CONSTRAINT "forum_topic_like_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "forum_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic_like" ADD CONSTRAINT "forum_topic_like_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "forum_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic_tag" ADD CONSTRAINT "forum_topic_tag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "forum_tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic_tag" ADD CONSTRAINT "forum_topic_tag_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "forum_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic" ADD CONSTRAINT "forum_topic_client_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "client_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic" ADD CONSTRAINT "forum_topic_last_reply_user_id_fkey" FOREIGN KEY ("last_reply_user_id") REFERENCES "client_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic" ADD CONSTRAINT "forum_topic_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "forum_section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dictionary_item" ADD CONSTRAINT "dictionary_item_dictionary_code_fkey" FOREIGN KEY ("dictionary_code") REFERENCES "dictionary"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_author" ADD CONSTRAINT "work_comic_author_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "work_author"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_author" ADD CONSTRAINT "work_comic_author_comic_id_fkey" FOREIGN KEY ("comic_id") REFERENCES "work_comic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_category" ADD CONSTRAINT "work_comic_category_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "work_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_category" ADD CONSTRAINT "work_comic_category_comic_id_fkey" FOREIGN KEY ("comic_id") REFERENCES "work_comic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_chapter" ADD CONSTRAINT "work_comic_chapter_comic_id_fkey" FOREIGN KEY ("comic_id") REFERENCES "work_comic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_chapter" ADD CONSTRAINT "work_comic_chapter_required_download_level_id_fkey" FOREIGN KEY ("required_download_level_id") REFERENCES "member_level"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_chapter" ADD CONSTRAINT "work_comic_chapter_required_read_level_id_fkey" FOREIGN KEY ("required_read_level_id") REFERENCES "member_level"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_tag" ADD CONSTRAINT "work_comic_tag_comic_id_fkey" FOREIGN KEY ("comic_id") REFERENCES "work_comic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_tag" ADD CONSTRAINT "work_comic_tag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "work_tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TopicTags" ADD CONSTRAINT "_TopicTags_A_fkey" FOREIGN KEY ("A") REFERENCES "forum_tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TopicTags" ADD CONSTRAINT "_TopicTags_B_fkey" FOREIGN KEY ("B") REFERENCES "forum_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
