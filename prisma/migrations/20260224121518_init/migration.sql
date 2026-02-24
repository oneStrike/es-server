/*
  Warnings:

  - You are about to drop the column `age_rating` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `alias` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `copyright` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `cover` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `deleted_at` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `disclaimer` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `favorite_count` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `is_hot` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `is_new` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `is_published` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `is_recommended` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `language` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `last_updated` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `like_count` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `original_source` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `popularity` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `publish_at` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `publisher` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `rating` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `rating_count` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `recommend_weight` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `region` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `remark` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `serial_status` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `view_count` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the `work_comic_author` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `work_comic_category` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `work_comic_chapter` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `work_comic_chapter_comment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `work_comic_chapter_comment_report` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `work_comic_chapter_download` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `work_comic_chapter_like` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `work_comic_chapter_purchase` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `work_comic_favorite` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `work_comic_like` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `work_comic_tag` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[workId]` on the table `work_comic` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `work_comic` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workId` to the `work_comic` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "work_comic_author" DROP CONSTRAINT "work_comic_author_author_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_author" DROP CONSTRAINT "work_comic_author_comic_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_category" DROP CONSTRAINT "work_comic_category_category_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_category" DROP CONSTRAINT "work_comic_category_comic_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_chapter" DROP CONSTRAINT "work_comic_chapter_comic_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_chapter" DROP CONSTRAINT "work_comic_chapter_required_download_level_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_chapter" DROP CONSTRAINT "work_comic_chapter_required_read_level_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_chapter_comment" DROP CONSTRAINT "work_comic_chapter_comment_actual_reply_to_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_chapter_comment" DROP CONSTRAINT "work_comic_chapter_comment_chapter_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_chapter_comment" DROP CONSTRAINT "work_comic_chapter_comment_reply_to_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_chapter_comment" DROP CONSTRAINT "work_comic_chapter_comment_user_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_chapter_comment_report" DROP CONSTRAINT "work_comic_chapter_comment_report_comment_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_chapter_comment_report" DROP CONSTRAINT "work_comic_chapter_comment_report_handler_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_chapter_comment_report" DROP CONSTRAINT "work_comic_chapter_comment_report_reporter_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_chapter_download" DROP CONSTRAINT "work_comic_chapter_download_chapter_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_chapter_download" DROP CONSTRAINT "work_comic_chapter_download_user_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_chapter_like" DROP CONSTRAINT "work_comic_chapter_like_chapter_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_chapter_like" DROP CONSTRAINT "work_comic_chapter_like_user_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_chapter_purchase" DROP CONSTRAINT "work_comic_chapter_purchase_chapter_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_chapter_purchase" DROP CONSTRAINT "work_comic_chapter_purchase_user_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_favorite" DROP CONSTRAINT "work_comic_favorite_comic_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_favorite" DROP CONSTRAINT "work_comic_favorite_user_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_like" DROP CONSTRAINT "work_comic_like_comic_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_like" DROP CONSTRAINT "work_comic_like_user_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_tag" DROP CONSTRAINT "work_comic_tag_comic_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comic_tag" DROP CONSTRAINT "work_comic_tag_tag_id_fkey";

-- DropIndex
DROP INDEX "user_level_rule_created_at_idx";

-- DropIndex
DROP INDEX "user_level_rule_is_enabled_required_experience_idx";

-- DropIndex
DROP INDEX "work_comic_age_rating_idx";

-- DropIndex
DROP INDEX "work_comic_created_at_idx";

-- DropIndex
DROP INDEX "work_comic_deleted_at_idx";

-- DropIndex
DROP INDEX "work_comic_favorite_count_idx";

-- DropIndex
DROP INDEX "work_comic_is_hot_is_new_idx";

-- DropIndex
DROP INDEX "work_comic_is_published_is_recommended_idx";

-- DropIndex
DROP INDEX "work_comic_is_published_publish_at_idx";

-- DropIndex
DROP INDEX "work_comic_is_published_serial_status_last_updated_idx";

-- DropIndex
DROP INDEX "work_comic_is_recommended_idx";

-- DropIndex
DROP INDEX "work_comic_language_region_idx";

-- DropIndex
DROP INDEX "work_comic_last_updated_idx";

-- DropIndex
DROP INDEX "work_comic_like_count_idx";

-- DropIndex
DROP INDEX "work_comic_name_idx";

-- DropIndex
DROP INDEX "work_comic_popularity_idx";

-- DropIndex
DROP INDEX "work_comic_rating_idx";

-- DropIndex
DROP INDEX "work_comic_serial_status_idx";

-- DropIndex
DROP INDEX "work_comic_view_count_idx";

-- AlterTable
ALTER TABLE "work_comic" DROP COLUMN "age_rating",
DROP COLUMN "alias",
DROP COLUMN "copyright",
DROP COLUMN "cover",
DROP COLUMN "created_at",
DROP COLUMN "deleted_at",
DROP COLUMN "description",
DROP COLUMN "disclaimer",
DROP COLUMN "favorite_count",
DROP COLUMN "is_hot",
DROP COLUMN "is_new",
DROP COLUMN "is_published",
DROP COLUMN "is_recommended",
DROP COLUMN "language",
DROP COLUMN "last_updated",
DROP COLUMN "like_count",
DROP COLUMN "name",
DROP COLUMN "original_source",
DROP COLUMN "popularity",
DROP COLUMN "publish_at",
DROP COLUMN "publisher",
DROP COLUMN "rating",
DROP COLUMN "rating_count",
DROP COLUMN "recommend_weight",
DROP COLUMN "region",
DROP COLUMN "remark",
DROP COLUMN "serial_status",
DROP COLUMN "updated_at",
DROP COLUMN "view_count",
ADD COLUMN     "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMPTZ(6) NOT NULL,
ADD COLUMN     "workId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "work_comic_author";

-- DropTable
DROP TABLE "work_comic_category";

-- DropTable
DROP TABLE "work_comic_chapter";

-- DropTable
DROP TABLE "work_comic_chapter_comment";

-- DropTable
DROP TABLE "work_comic_chapter_comment_report";

-- DropTable
DROP TABLE "work_comic_chapter_download";

-- DropTable
DROP TABLE "work_comic_chapter_like";

-- DropTable
DROP TABLE "work_comic_chapter_purchase";

-- DropTable
DROP TABLE "work_comic_favorite";

-- DropTable
DROP TABLE "work_comic_like";

-- DropTable
DROP TABLE "work_comic_tag";

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
    "role" VARCHAR(50),
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
CREATE TABLE "work_chapter_download" (
    "id" SERIAL NOT NULL,
    "chapter_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_chapter_download_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_chapter_like" (
    "id" SERIAL NOT NULL,
    "chapter_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_chapter_like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_chapter_purchase" (
    "id" SERIAL NOT NULL,
    "chapter_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_chapter_purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_chapter" (
    "id" SERIAL NOT NULL,
    "work_id" INTEGER NOT NULL,
    "work_type" SMALLINT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "subtitle" VARCHAR(200),
    "description" VARCHAR(1000),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "read_rule" SMALLINT NOT NULL DEFAULT 0,
    "download_rule" SMALLINT NOT NULL DEFAULT 1,
    "read_points" INTEGER DEFAULT 0,
    "download_points" INTEGER DEFAULT 0,
    "required_read_level_id" INTEGER,
    "required_download_level_id" INTEGER,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "is_preview" BOOLEAN NOT NULL DEFAULT false,
    "can_comment" BOOLEAN NOT NULL DEFAULT true,
    "publish_at" TIMESTAMPTZ(6),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "purchase_count" INTEGER NOT NULL DEFAULT 0,
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "content_path" VARCHAR(500),
    "remark" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "work_chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_comment_report" (
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

    CONSTRAINT "work_comment_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_comment" (
    "id" SERIAL NOT NULL,
    "work_id" INTEGER NOT NULL,
    "work_type" SMALLINT NOT NULL,
    "chapter_id" INTEGER,
    "user_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "sensitive_word_hits" JSONB,
    "reply_to_id" INTEGER,
    "actual_reply_to_id" INTEGER,
    "floor" INTEGER,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "audit_status" SMALLINT NOT NULL DEFAULT 0,
    "audit_reason" VARCHAR(500),
    "audit_at" TIMESTAMPTZ(6),
    "audit_by_id" INTEGER,
    "audit_role" SMALLINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "work_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_favorite" (
    "id" SERIAL NOT NULL,
    "work_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "work_type" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_like" (
    "id" SERIAL NOT NULL,
    "work_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_like_pkey" PRIMARY KEY ("id")
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
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishAt" DATE,
    "lastUpdated" TIMESTAMPTZ(6),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "favoriteCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "isRecommended" BOOLEAN NOT NULL DEFAULT false,
    "isHot" BOOLEAN NOT NULL DEFAULT false,
    "isNew" BOOLEAN NOT NULL DEFAULT false,
    "recommendWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "work_pkey" PRIMARY KEY ("id")
);

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
CREATE INDEX "work_chapter_download_chapter_id_idx" ON "work_chapter_download"("chapter_id");

-- CreateIndex
CREATE INDEX "work_chapter_download_user_id_idx" ON "work_chapter_download"("user_id");

-- CreateIndex
CREATE INDEX "work_chapter_download_created_at_idx" ON "work_chapter_download"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "work_chapter_download_chapter_id_user_id_key" ON "work_chapter_download"("chapter_id", "user_id");

-- CreateIndex
CREATE INDEX "work_chapter_like_chapter_id_idx" ON "work_chapter_like"("chapter_id");

-- CreateIndex
CREATE INDEX "work_chapter_like_user_id_idx" ON "work_chapter_like"("user_id");

-- CreateIndex
CREATE INDEX "work_chapter_like_created_at_idx" ON "work_chapter_like"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "work_chapter_like_chapter_id_user_id_key" ON "work_chapter_like"("chapter_id", "user_id");

-- CreateIndex
CREATE INDEX "work_chapter_purchase_chapter_id_idx" ON "work_chapter_purchase"("chapter_id");

-- CreateIndex
CREATE INDEX "work_chapter_purchase_user_id_idx" ON "work_chapter_purchase"("user_id");

-- CreateIndex
CREATE INDEX "work_chapter_purchase_created_at_idx" ON "work_chapter_purchase"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "work_chapter_purchase_chapter_id_user_id_key" ON "work_chapter_purchase"("chapter_id", "user_id");

-- CreateIndex
CREATE INDEX "work_chapter_work_id_idx" ON "work_chapter"("work_id");

-- CreateIndex
CREATE INDEX "work_chapter_work_id_sort_order_idx" ON "work_chapter"("work_id", "sort_order");

-- CreateIndex
CREATE INDEX "work_chapter_is_published_publish_at_idx" ON "work_chapter"("is_published", "publish_at");

-- CreateIndex
CREATE INDEX "work_chapter_read_rule_idx" ON "work_chapter"("read_rule");

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
CREATE INDEX "work_chapter_required_download_level_id_idx" ON "work_chapter"("required_download_level_id");

-- CreateIndex
CREATE INDEX "work_chapter_work_type_idx" ON "work_chapter"("work_type");

-- CreateIndex
CREATE UNIQUE INDEX "work_chapter_work_id_sort_order_key" ON "work_chapter"("work_id", "sort_order");

-- CreateIndex
CREATE INDEX "work_comment_report_reporter_id_idx" ON "work_comment_report"("reporter_id");

-- CreateIndex
CREATE INDEX "work_comment_report_handler_id_idx" ON "work_comment_report"("handler_id");

-- CreateIndex
CREATE INDEX "work_comment_report_comment_id_idx" ON "work_comment_report"("comment_id");

-- CreateIndex
CREATE INDEX "work_comment_report_status_idx" ON "work_comment_report"("status");

-- CreateIndex
CREATE INDEX "work_comment_report_created_at_idx" ON "work_comment_report"("created_at");

-- CreateIndex
CREATE INDEX "work_comment_work_id_idx" ON "work_comment"("work_id");

-- CreateIndex
CREATE INDEX "work_comment_chapter_id_idx" ON "work_comment"("chapter_id");

-- CreateIndex
CREATE INDEX "work_comment_user_id_idx" ON "work_comment"("user_id");

-- CreateIndex
CREATE INDEX "work_comment_created_at_idx" ON "work_comment"("created_at");

-- CreateIndex
CREATE INDEX "work_comment_audit_status_idx" ON "work_comment"("audit_status");

-- CreateIndex
CREATE INDEX "work_comment_is_hidden_idx" ON "work_comment"("is_hidden");

-- CreateIndex
CREATE INDEX "work_comment_reply_to_id_idx" ON "work_comment"("reply_to_id");

-- CreateIndex
CREATE INDEX "work_comment_actual_reply_to_id_idx" ON "work_comment"("actual_reply_to_id");

-- CreateIndex
CREATE INDEX "work_comment_deleted_at_idx" ON "work_comment"("deleted_at");

-- CreateIndex
CREATE INDEX "work_comment_work_type_idx" ON "work_comment"("work_type");

-- CreateIndex
CREATE INDEX "work_comment_work_id_created_at_idx" ON "work_comment"("work_id", "created_at");

-- CreateIndex
CREATE INDEX "work_comment_chapter_id_created_at_idx" ON "work_comment"("chapter_id", "created_at");

-- CreateIndex
CREATE INDEX "work_favorite_work_id_idx" ON "work_favorite"("work_id");

-- CreateIndex
CREATE INDEX "work_favorite_user_id_idx" ON "work_favorite"("user_id");

-- CreateIndex
CREATE INDEX "work_favorite_work_type_idx" ON "work_favorite"("work_type");

-- CreateIndex
CREATE INDEX "work_favorite_created_at_idx" ON "work_favorite"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "work_favorite_work_id_user_id_key" ON "work_favorite"("work_id", "user_id");

-- CreateIndex
CREATE INDEX "work_like_work_id_idx" ON "work_like"("work_id");

-- CreateIndex
CREATE INDEX "work_like_user_id_idx" ON "work_like"("user_id");

-- CreateIndex
CREATE INDEX "work_like_created_at_idx" ON "work_like"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "work_like_work_id_user_id_key" ON "work_like"("work_id", "user_id");

-- CreateIndex
CREATE INDEX "work_tag_relation_tag_id_idx" ON "work_tag_relation"("tag_id");

-- CreateIndex
CREATE INDEX "work_tag_relation_work_id_idx" ON "work_tag_relation"("work_id");

-- CreateIndex
CREATE INDEX "work_tag_relation_sort_order_idx" ON "work_tag_relation"("sort_order");

-- CreateIndex
CREATE INDEX "work_tag_relation_work_id_sort_order_idx" ON "work_tag_relation"("work_id", "sort_order");

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
CREATE UNIQUE INDEX "work_comic_workId_key" ON "work_comic"("workId");

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
ALTER TABLE "work_chapter_download" ADD CONSTRAINT "work_chapter_download_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "work_chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_chapter_download" ADD CONSTRAINT "work_chapter_download_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_chapter_like" ADD CONSTRAINT "work_chapter_like_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "work_chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_chapter_like" ADD CONSTRAINT "work_chapter_like_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_chapter_purchase" ADD CONSTRAINT "work_chapter_purchase_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "work_chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_chapter_purchase" ADD CONSTRAINT "work_chapter_purchase_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_chapter" ADD CONSTRAINT "work_chapter_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_chapter" ADD CONSTRAINT "work_chapter_required_download_level_id_fkey" FOREIGN KEY ("required_download_level_id") REFERENCES "user_level_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_chapter" ADD CONSTRAINT "work_chapter_required_read_level_id_fkey" FOREIGN KEY ("required_read_level_id") REFERENCES "user_level_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comment_report" ADD CONSTRAINT "work_comment_report_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comment_report" ADD CONSTRAINT "work_comment_report_handler_id_fkey" FOREIGN KEY ("handler_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comment_report" ADD CONSTRAINT "work_comment_report_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "work_comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comment" ADD CONSTRAINT "work_comment_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comment" ADD CONSTRAINT "work_comment_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "work_chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comment" ADD CONSTRAINT "work_comment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comment" ADD CONSTRAINT "work_comment_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "work_comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_comment" ADD CONSTRAINT "work_comment_actual_reply_to_id_fkey" FOREIGN KEY ("actual_reply_to_id") REFERENCES "work_comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_favorite" ADD CONSTRAINT "work_favorite_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_favorite" ADD CONSTRAINT "work_favorite_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_like" ADD CONSTRAINT "work_like_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_like" ADD CONSTRAINT "work_like_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tag_relation" ADD CONSTRAINT "work_tag_relation_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_tag_relation" ADD CONSTRAINT "work_tag_relation_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "work_tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
