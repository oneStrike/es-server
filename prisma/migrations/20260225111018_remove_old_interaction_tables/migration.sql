/*
  Warnings:

  - You are about to drop the column `reply_id` on the `forum_notification` table. All the data in the column will be lost.
  - You are about to drop the `forum_reply` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `forum_reply_like` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `forum_topic_favorite` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `forum_topic_like` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `forum_view` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `work_chapter_download` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `work_chapter_like` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `work_comment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `work_comment_report` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `work_favorite` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `work_like` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "forum_notification" DROP CONSTRAINT "forum_notification_reply_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_reply" DROP CONSTRAINT "forum_reply_actual_reply_to_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_reply" DROP CONSTRAINT "forum_reply_reply_to_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_reply" DROP CONSTRAINT "forum_reply_topic_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_reply" DROP CONSTRAINT "forum_reply_user_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_reply_like" DROP CONSTRAINT "forum_reply_like_reply_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_reply_like" DROP CONSTRAINT "forum_reply_like_user_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_topic_favorite" DROP CONSTRAINT "forum_topic_favorite_topic_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_topic_favorite" DROP CONSTRAINT "forum_topic_favorite_user_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_topic_like" DROP CONSTRAINT "forum_topic_like_topic_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_topic_like" DROP CONSTRAINT "forum_topic_like_user_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_view" DROP CONSTRAINT "forum_view_reply_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_view" DROP CONSTRAINT "forum_view_topic_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_view" DROP CONSTRAINT "forum_view_user_id_fkey";

-- DropForeignKey
ALTER TABLE "work_chapter_download" DROP CONSTRAINT "work_chapter_download_chapter_id_fkey";

-- DropForeignKey
ALTER TABLE "work_chapter_download" DROP CONSTRAINT "work_chapter_download_user_id_fkey";

-- DropForeignKey
ALTER TABLE "work_chapter_like" DROP CONSTRAINT "work_chapter_like_chapter_id_fkey";

-- DropForeignKey
ALTER TABLE "work_chapter_like" DROP CONSTRAINT "work_chapter_like_user_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comment" DROP CONSTRAINT "work_comment_actual_reply_to_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comment" DROP CONSTRAINT "work_comment_chapter_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comment" DROP CONSTRAINT "work_comment_reply_to_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comment" DROP CONSTRAINT "work_comment_user_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comment" DROP CONSTRAINT "work_comment_work_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comment_report" DROP CONSTRAINT "work_comment_report_comment_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comment_report" DROP CONSTRAINT "work_comment_report_handler_id_fkey";

-- DropForeignKey
ALTER TABLE "work_comment_report" DROP CONSTRAINT "work_comment_report_reporter_id_fkey";

-- DropForeignKey
ALTER TABLE "work_favorite" DROP CONSTRAINT "work_favorite_user_id_fkey";

-- DropForeignKey
ALTER TABLE "work_favorite" DROP CONSTRAINT "work_favorite_work_id_fkey";

-- DropForeignKey
ALTER TABLE "work_like" DROP CONSTRAINT "work_like_user_id_fkey";

-- DropForeignKey
ALTER TABLE "work_like" DROP CONSTRAINT "work_like_work_id_fkey";

-- DropIndex
DROP INDEX "forum_notification_reply_id_idx";

-- AlterTable
ALTER TABLE "forum_notification" DROP COLUMN "reply_id";

-- DropTable
DROP TABLE "forum_reply";

-- DropTable
DROP TABLE "forum_reply_like";

-- DropTable
DROP TABLE "forum_topic_favorite";

-- DropTable
DROP TABLE "forum_topic_like";

-- DropTable
DROP TABLE "forum_view";

-- DropTable
DROP TABLE "work_chapter_download";

-- DropTable
DROP TABLE "work_chapter_like";

-- DropTable
DROP TABLE "work_comment";

-- DropTable
DROP TABLE "work_comment_report";

-- DropTable
DROP TABLE "work_favorite";

-- DropTable
DROP TABLE "work_like";
