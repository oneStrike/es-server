/*
  Warnings:

  - The `contents` column on the `work_comic_chapter` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `dictionary` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `dictionary_item` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `forum_experience_record` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `forum_experience_rule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `forum_level_rule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `forum_point_record` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `forum_point_rule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `member_level` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `request_log` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "app_user" DROP CONSTRAINT "app_user_level_id_fkey";

-- DropForeignKey
ALTER TABLE "dictionary_item" DROP CONSTRAINT "dictionary_item_dictionary_code_fkey";

-- DropForeignKey
ALTER TABLE "forum_experience_record" DROP CONSTRAINT "forum_experience_record_rule_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_experience_record" DROP CONSTRAINT "forum_experience_record_user_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_point_record" DROP CONSTRAINT "forum_point_record_rule_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_point_record" DROP CONSTRAINT "forum_point_record_user_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_section" DROP CONSTRAINT "forum_section_user_level_rule_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_chapter" DROP CONSTRAINT "work_comic_chapter_required_download_level_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_chapter" DROP CONSTRAINT "work_comic_chapter_required_read_level_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_tag" DROP CONSTRAINT "work_comic_tag_tag_id_fkey";

-- AlterTable
ALTER TABLE "work_comic_chapter" DROP COLUMN "contents",
ADD COLUMN     "contents" JSONB NOT NULL DEFAULT '[]';

-- DropTable
DROP TABLE "dictionary";

-- DropTable
DROP TABLE "dictionary_item";

-- DropTable
DROP TABLE "forum_experience_record";

-- DropTable
DROP TABLE "forum_experience_rule";

-- DropTable
DROP TABLE "forum_level_rule";

-- DropTable
DROP TABLE "forum_point_record";

-- DropTable
DROP TABLE "forum_point_rule";

-- DropTable
DROP TABLE "member_level";

-- DropTable
DROP TABLE "request_log";

-- CreateTable
CREATE TABLE "app_experience_record" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "rule_id" INTEGER,
    "experience" INTEGER NOT NULL,
    "before_experience" INTEGER NOT NULL,
    "after_experience" INTEGER NOT NULL,
    "remark" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_experience_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_experience_rule" (
    "id" SERIAL NOT NULL,
    "type" SMALLINT NOT NULL,
    "experience" INTEGER NOT NULL,
    "daily_limit" INTEGER NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "remark" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_experience_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_level_rule" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "required_experience" INTEGER NOT NULL,
    "description" VARCHAR(200),
    "icon" VARCHAR(255),
    "badge" VARCHAR(255),
    "color" VARCHAR(20),
    "sortOrder" SMALLINT NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "daily_topic_limit" SMALLINT NOT NULL DEFAULT 0,
    "daily_reply_comment_limit" SMALLINT NOT NULL DEFAULT 0,
    "post_interval" SMALLINT NOT NULL DEFAULT 0,
    "daily_like_limit" SMALLINT NOT NULL DEFAULT 0,
    "daily_favorite_limit" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_level_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_point_record" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "rule_id" INTEGER,
    "points" INTEGER NOT NULL,
    "before_points" INTEGER NOT NULL,
    "after_points" INTEGER NOT NULL,
    "remark" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_point_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_point_rule" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "type" SMALLINT NOT NULL,
    "points" INTEGER NOT NULL,
    "daily_limit" INTEGER NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "remark" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_point_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation_member_level" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "level" SMALLINT NOT NULL DEFAULT 1,
    "icon" VARCHAR(200) NOT NULL,
    "color" VARCHAR(20),
    "description" VARCHAR(500) NOT NULL,
    "points" INTEGER NOT NULL,
    "login_days" SMALLINT NOT NULL DEFAULT 0,
    "discount" DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "blacklist_limit" SMALLINT NOT NULL DEFAULT 10,
    "work_collection_limit" SMALLINT NOT NULL DEFAULT 100,
    "remark" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "operation_member_level_pkey" PRIMARY KEY ("id")
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
    "order" SMALLSERIAL,
    "cover" VARCHAR(200),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "sys_dictionary_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_experience_record_user_id_idx" ON "app_experience_record"("user_id");

-- CreateIndex
CREATE INDEX "app_experience_record_rule_id_idx" ON "app_experience_record"("rule_id");

-- CreateIndex
CREATE INDEX "app_experience_record_created_at_idx" ON "app_experience_record"("created_at");

-- CreateIndex
CREATE INDEX "app_experience_record_user_id_created_at_idx" ON "app_experience_record"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "app_experience_rule_type_key" ON "app_experience_rule"("type");

-- CreateIndex
CREATE INDEX "app_experience_rule_type_idx" ON "app_experience_rule"("type");

-- CreateIndex
CREATE INDEX "app_experience_rule_is_enabled_idx" ON "app_experience_rule"("is_enabled");

-- CreateIndex
CREATE INDEX "app_experience_rule_created_at_idx" ON "app_experience_rule"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "app_level_rule_name_key" ON "app_level_rule"("name");

-- CreateIndex
CREATE INDEX "app_level_rule_is_enabled_sortOrder_idx" ON "app_level_rule"("is_enabled", "sortOrder");

-- CreateIndex
CREATE INDEX "app_level_rule_is_enabled_required_experience_idx" ON "app_level_rule"("is_enabled", "required_experience");

-- CreateIndex
CREATE INDEX "app_level_rule_created_at_idx" ON "app_level_rule"("created_at");

-- CreateIndex
CREATE INDEX "app_point_record_user_id_idx" ON "app_point_record"("user_id");

-- CreateIndex
CREATE INDEX "app_point_record_rule_id_idx" ON "app_point_record"("rule_id");

-- CreateIndex
CREATE INDEX "app_point_record_created_at_idx" ON "app_point_record"("created_at");

-- CreateIndex
CREATE INDEX "app_point_record_user_id_created_at_idx" ON "app_point_record"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "app_point_rule_name_key" ON "app_point_rule"("name");

-- CreateIndex
CREATE UNIQUE INDEX "app_point_rule_type_key" ON "app_point_rule"("type");

-- CreateIndex
CREATE INDEX "app_point_rule_type_idx" ON "app_point_rule"("type");

-- CreateIndex
CREATE INDEX "app_point_rule_is_enabled_idx" ON "app_point_rule"("is_enabled");

-- CreateIndex
CREATE INDEX "app_point_rule_created_at_idx" ON "app_point_rule"("created_at");

-- CreateIndex
CREATE INDEX "operation_member_level_points_idx" ON "operation_member_level"("points");

-- CreateIndex
CREATE INDEX "operation_member_level_is_enabled_idx" ON "operation_member_level"("is_enabled");

-- CreateIndex
CREATE INDEX "operation_member_level_created_at_idx" ON "operation_member_level"("created_at");

-- CreateIndex
CREATE INDEX "operation_member_level_level_idx" ON "operation_member_level"("level");

-- CreateIndex
CREATE INDEX "sys_request_log_created_at_idx" ON "sys_request_log"("created_at");

-- CreateIndex
CREATE INDEX "sys_request_log_user_id_idx" ON "sys_request_log"("user_id");

-- CreateIndex
CREATE INDEX "sys_request_log_username_idx" ON "sys_request_log"("username");

-- CreateIndex
CREATE INDEX "sys_request_log_is_success_idx" ON "sys_request_log"("is_success");

-- CreateIndex
CREATE UNIQUE INDEX "sys_dictionary_name_key" ON "sys_dictionary"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sys_dictionary_code_key" ON "sys_dictionary"("code");

-- CreateIndex
CREATE INDEX "sys_dictionary_item_dictionary_code_idx" ON "sys_dictionary_item"("dictionary_code");

-- CreateIndex
CREATE INDEX "sys_dictionary_item_order_idx" ON "sys_dictionary_item"("order");

-- CreateIndex
CREATE UNIQUE INDEX "sys_dictionary_item_dictionary_code_code_key" ON "sys_dictionary_item"("dictionary_code", "code");

-- CreateIndex
CREATE INDEX "forum_report_handler_id_idx" ON "forum_report"("handler_id");

-- CreateIndex
CREATE INDEX "forum_topic_section_id_last_reply_at_idx" ON "forum_topic"("section_id", "last_reply_at");

-- AddForeignKey
ALTER TABLE "app_experience_record" ADD CONSTRAINT "app_experience_record_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "app_experience_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_experience_record" ADD CONSTRAINT "app_experience_record_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_point_record" ADD CONSTRAINT "app_point_record_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "app_point_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_point_record" ADD CONSTRAINT "app_point_record_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "app_level_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_section" ADD CONSTRAINT "forum_section_user_level_rule_id_fkey" FOREIGN KEY ("user_level_rule_id") REFERENCES "app_level_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_view" ADD CONSTRAINT "forum_view_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "forum_reply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sys_dictionary_item" ADD CONSTRAINT "sys_dictionary_item_dictionary_code_fkey" FOREIGN KEY ("dictionary_code") REFERENCES "sys_dictionary"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_chapter" ADD CONSTRAINT "work_comic_chapter_required_download_level_id_fkey" FOREIGN KEY ("required_download_level_id") REFERENCES "operation_member_level"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_chapter" ADD CONSTRAINT "work_comic_chapter_required_read_level_id_fkey" FOREIGN KEY ("required_read_level_id") REFERENCES "operation_member_level"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comic_tag" ADD CONSTRAINT "work_comic_tag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "work_tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
