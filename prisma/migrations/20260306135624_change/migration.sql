/*
  Warnings:

  - You are about to drop the `forum_reply` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `forum_reply_like` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `forum_report` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_comment_report` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `work_comment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `work_comment_report` table. If the table is not empty, all the data it contains will be lost.

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
ALTER TABLE "forum_report" DROP CONSTRAINT "forum_report_handler_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_report" DROP CONSTRAINT "forum_report_reporter_id_fkey";

-- DropForeignKey
ALTER TABLE "user_comment_report" DROP CONSTRAINT "user_comment_report_comment_id_fkey";

-- DropForeignKey
ALTER TABLE "user_comment_report" DROP CONSTRAINT "user_comment_report_handler_id_fkey";

-- DropForeignKey
ALTER TABLE "user_comment_report" DROP CONSTRAINT "user_comment_report_reporter_id_fkey";

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

-- DropTable
DROP TABLE "forum_reply";

-- DropTable
DROP TABLE "forum_reply_like";

-- DropTable
DROP TABLE "forum_report";

-- DropTable
DROP TABLE "user_comment_report";

-- DropTable
DROP TABLE "work_comment";

-- DropTable
DROP TABLE "work_comment_report";

-- CreateTable
CREATE TABLE "user_report" (
    "id" SERIAL NOT NULL,
    "reporter_id" INTEGER NOT NULL,
    "handler_id" INTEGER,
    "target_type" SMALLINT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "reason" VARCHAR(50) NOT NULL,
    "description" VARCHAR(500),
    "evidence_url" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "handling_note" VARCHAR(500),
    "handled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_report_target_type_target_id_idx" ON "user_report"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "user_report_reporter_id_idx" ON "user_report"("reporter_id");

-- CreateIndex
CREATE INDEX "user_report_handler_id_idx" ON "user_report"("handler_id");

-- CreateIndex
CREATE INDEX "user_report_status_idx" ON "user_report"("status");

-- CreateIndex
CREATE INDEX "user_report_created_at_idx" ON "user_report"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_report_reporter_id_target_type_target_id_key" ON "user_report"("reporter_id", "target_type", "target_id");

-- AddForeignKey
ALTER TABLE "user_report" ADD CONSTRAINT "user_report_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_report" ADD CONSTRAINT "user_report_handler_id_fkey" FOREIGN KEY ("handler_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
