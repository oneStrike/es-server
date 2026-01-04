-- CreateTable
CREATE TABLE "forum_audit_log" (
    "id" SERIAL NOT NULL,
    "object_type" SMALLINT NOT NULL,
    "object_id" INTEGER NOT NULL,
    "audit_status" SMALLINT NOT NULL,
    "audit_reason" VARCHAR(500),
    "audit_by" INTEGER NOT NULL,
    "audit_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

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
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "forum_level_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_moderator_action_log" (
    "id" SERIAL NOT NULL,
    "moderator_id" INTEGER NOT NULL,
    "action_type" VARCHAR(50) NOT NULL,
    "action_description" VARCHAR(200) NOT NULL,
    "target_type" VARCHAR(20) NOT NULL,
    "target_id" INTEGER NOT NULL,
    "before_data" TEXT,
    "after_data" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_moderator_action_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_moderator_section" (
    "id" SERIAL NOT NULL,
    "moderator_id" INTEGER NOT NULL,
    "section_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_moderator_section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_moderator" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "permission_mask" INTEGER NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "remark" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "forum_moderator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_notification" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" SMALLINT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "object_type" SMALLINT NOT NULL,
    "object_id" INTEGER NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
    "object_type" SMALLINT NOT NULL,
    "object_id" INTEGER NOT NULL,
    "remark" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "forum_point_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_profile_badge" (
    "id" SERIAL NOT NULL,
    "profile_id" INTEGER NOT NULL,
    "badge_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_profile_badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_profile" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "level_id" INTEGER,
    "topic_count" INTEGER NOT NULL DEFAULT 0,
    "reply_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "favorite_count" INTEGER NOT NULL DEFAULT 0,
    "signature" VARCHAR(200),
    "bio" VARCHAR(500),
    "last_post_at" TIMESTAMPTZ,
    "last_visit_at" TIMESTAMPTZ,
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "ban_reason" VARCHAR(500),
    "ban_until" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "forum_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_reply_like" (
    "id" SERIAL NOT NULL,
    "reply_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
    "audit_at" TIMESTAMPTZ,
    "audit_by" INTEGER,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "forum_reply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_section" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(500),
    "icon" VARCHAR(255),
    "cover" VARCHAR(500),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "topic_count" INTEGER NOT NULL DEFAULT 0,
    "reply_count" INTEGER NOT NULL DEFAULT 0,
    "last_post_at" TIMESTAMPTZ,
    "last_topic_id" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "forum_section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_sensitive_word" (
    "id" SERIAL NOT NULL,
    "word" VARCHAR(100) NOT NULL,
    "replace_word" VARCHAR(100),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "remark" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

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
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "forum_tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_topic_favorite" (
    "id" SERIAL NOT NULL,
    "topic_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_topic_favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_topic_like" (
    "id" SERIAL NOT NULL,
    "topic_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_topic_like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_topic_tag" (
    "id" SERIAL NOT NULL,
    "topic_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
    "audit_at" TIMESTAMPTZ,
    "audit_by" INTEGER,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "reply_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "favorite_count" INTEGER NOT NULL DEFAULT 0,
    "last_reply_at" TIMESTAMPTZ,
    "last_reply_user_id" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "forum_topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TopicTags" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_TopicTags_AB_pkey" PRIMARY KEY ("A","B")
);

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
CREATE INDEX "forum_level_rule_order_idx" ON "forum_level_rule"("order");

-- CreateIndex
CREATE INDEX "forum_level_rule_required_points_idx" ON "forum_level_rule"("required_points");

-- CreateIndex
CREATE INDEX "forum_level_rule_is_enabled_idx" ON "forum_level_rule"("is_enabled");

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
CREATE INDEX "forum_moderator_permission_mask_idx" ON "forum_moderator"("permission_mask");

-- CreateIndex
CREATE INDEX "forum_moderator_is_enabled_idx" ON "forum_moderator"("is_enabled");

-- CreateIndex
CREATE INDEX "forum_moderator_created_at_idx" ON "forum_moderator"("created_at");

-- CreateIndex
CREATE INDEX "forum_moderator_deleted_at_idx" ON "forum_moderator"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "forum_moderator_user_id_key" ON "forum_moderator"("user_id");

-- CreateIndex
CREATE INDEX "forum_notification_user_id_idx" ON "forum_notification"("user_id");

-- CreateIndex
CREATE INDEX "forum_notification_type_idx" ON "forum_notification"("type");

-- CreateIndex
CREATE INDEX "forum_notification_object_type_object_id_idx" ON "forum_notification"("object_type", "object_id");

-- CreateIndex
CREATE INDEX "forum_notification_is_read_idx" ON "forum_notification"("is_read");

-- CreateIndex
CREATE INDEX "forum_notification_created_at_idx" ON "forum_notification"("created_at");

-- CreateIndex
CREATE INDEX "forum_notification_user_id_is_read_idx" ON "forum_notification"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "forum_notification_user_id_created_at_idx" ON "forum_notification"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "forum_point_record_user_id_idx" ON "forum_point_record"("user_id");

-- CreateIndex
CREATE INDEX "forum_point_record_rule_id_idx" ON "forum_point_record"("rule_id");

-- CreateIndex
CREATE INDEX "forum_point_record_object_type_object_id_idx" ON "forum_point_record"("object_type", "object_id");

-- CreateIndex
CREATE INDEX "forum_point_record_created_at_idx" ON "forum_point_record"("created_at");

-- CreateIndex
CREATE INDEX "forum_point_record_user_id_created_at_idx" ON "forum_point_record"("user_id", "created_at");

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
CREATE INDEX "forum_profile_last_post_at_idx" ON "forum_profile"("last_post_at");

-- CreateIndex
CREATE INDEX "forum_profile_last_visit_at_idx" ON "forum_profile"("last_visit_at");

-- CreateIndex
CREATE INDEX "forum_profile_is_banned_idx" ON "forum_profile"("is_banned");

-- CreateIndex
CREATE INDEX "forum_profile_created_at_idx" ON "forum_profile"("created_at");

-- CreateIndex
CREATE INDEX "forum_profile_deleted_at_idx" ON "forum_profile"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "forum_profile_user_id_key" ON "forum_profile"("user_id");

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
CREATE INDEX "forum_section_reply_count_idx" ON "forum_section"("reply_count");

-- CreateIndex
CREATE INDEX "forum_section_last_post_at_idx" ON "forum_section"("last_post_at");

-- CreateIndex
CREATE INDEX "forum_section_created_at_idx" ON "forum_section"("created_at");

-- CreateIndex
CREATE INDEX "forum_section_deleted_at_idx" ON "forum_section"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "forum_sensitive_word_word_key" ON "forum_sensitive_word"("word");

-- CreateIndex
CREATE INDEX "forum_sensitive_word_word_idx" ON "forum_sensitive_word"("word");

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
CREATE INDEX "_TopicTags_B_index" ON "_TopicTags"("B");

-- AddForeignKey
ALTER TABLE "client_notice" ADD CONSTRAINT "client_notice_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "client_page"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_audit_log" ADD CONSTRAINT "forum_audit_log_topic_id_fkey" FOREIGN KEY ("object_id") REFERENCES "forum_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_audit_log" ADD CONSTRAINT "forum_audit_log_reply_id_fkey" FOREIGN KEY ("object_id") REFERENCES "forum_reply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "forum_point_record" ADD CONSTRAINT "forum_point_record_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "forum_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_point_record" ADD CONSTRAINT "forum_point_record_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "forum_point_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_profile_badge" ADD CONSTRAINT "forum_profile_badge_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "forum_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_profile_badge" ADD CONSTRAINT "forum_profile_badge_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "forum_badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_profile" ADD CONSTRAINT "forum_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "client_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_profile" ADD CONSTRAINT "forum_profile_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "forum_level_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reply_like" ADD CONSTRAINT "forum_reply_like_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "forum_reply"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "forum_reply_like" ADD CONSTRAINT "forum_reply_like_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "forum_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reply" ADD CONSTRAINT "forum_reply_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "forum_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reply" ADD CONSTRAINT "forum_reply_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "forum_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reply" ADD CONSTRAINT "forum_reply_client_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "client_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reply" ADD CONSTRAINT "forum_reply_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "forum_reply"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "forum_section" ADD CONSTRAINT "forum_section_last_topic_id_fkey" FOREIGN KEY ("last_topic_id") REFERENCES "forum_topic"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "forum_topic_favorite" ADD CONSTRAINT "forum_topic_favorite_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "forum_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic_favorite" ADD CONSTRAINT "forum_topic_favorite_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "forum_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic_like" ADD CONSTRAINT "forum_topic_like_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "forum_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic_like" ADD CONSTRAINT "forum_topic_like_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "forum_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic_tag" ADD CONSTRAINT "forum_topic_tag_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "forum_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic_tag" ADD CONSTRAINT "forum_topic_tag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "forum_tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic" ADD CONSTRAINT "forum_topic_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "forum_section"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "forum_topic" ADD CONSTRAINT "forum_topic_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "forum_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic" ADD CONSTRAINT "forum_topic_client_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "client_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic" ADD CONSTRAINT "forum_topic_last_reply_user_id_fkey" FOREIGN KEY ("last_reply_user_id") REFERENCES "client_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dictionary_item" ADD CONSTRAINT "dictionary_item_dictionary_code_fkey" FOREIGN KEY ("dictionary_code") REFERENCES "dictionary"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_author" ADD CONSTRAINT "work_comic_author_comic_id_fkey" FOREIGN KEY ("comic_id") REFERENCES "work_comic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_author" ADD CONSTRAINT "work_comic_author_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "work_author"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_category" ADD CONSTRAINT "work_comic_category_comic_id_fkey" FOREIGN KEY ("comic_id") REFERENCES "work_comic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_category" ADD CONSTRAINT "work_comic_category_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "work_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_chapter" ADD CONSTRAINT "work_comic_chapter_comic_id_fkey" FOREIGN KEY ("comic_id") REFERENCES "work_comic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_chapter" ADD CONSTRAINT "work_comic_chapter_required_read_level_id_fkey" FOREIGN KEY ("required_read_level_id") REFERENCES "member_level"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_chapter" ADD CONSTRAINT "work_comic_chapter_required_download_level_id_fkey" FOREIGN KEY ("required_download_level_id") REFERENCES "member_level"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_tag" ADD CONSTRAINT "work_comic_tag_comic_id_fkey" FOREIGN KEY ("comic_id") REFERENCES "work_comic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_tag" ADD CONSTRAINT "work_comic_tag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "work_tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TopicTags" ADD CONSTRAINT "_TopicTags_A_fkey" FOREIGN KEY ("A") REFERENCES "forum_tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TopicTags" ADD CONSTRAINT "_TopicTags_B_fkey" FOREIGN KEY ("B") REFERENCES "forum_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
