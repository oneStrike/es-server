/*
  Warnings:

  - You are about to drop the column `profile_id` on the `forum_moderator` table. All the data in the column will be lost.
  - You are about to drop the column `profile_id` on the `forum_profile_badge` table. All the data in the column will be lost.
  - You are about to drop the column `profile_id` on the `forum_reply` table. All the data in the column will be lost.
  - You are about to drop the column `profile_id` on the `forum_reply_like` table. All the data in the column will be lost.
  - You are about to drop the column `last_reply_profile_id` on the `forum_topic` table. All the data in the column will be lost.
  - You are about to drop the column `profile_id` on the `forum_topic` table. All the data in the column will be lost.
  - You are about to drop the column `profile_id` on the `forum_topic_favorite` table. All the data in the column will be lost.
  - You are about to drop the column `profile_id` on the `forum_topic_like` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[user_id]` on the table `forum_moderator` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id,badge_id]` on the table `forum_profile_badge` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[reply_id,user_id]` on the table `forum_reply_like` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[topic_id,user_id]` on the table `forum_topic_favorite` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[topic_id,user_id]` on the table `forum_topic_like` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `user_id` to the `forum_moderator` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `forum_profile_badge` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `forum_reply` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `forum_reply_like` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `forum_topic` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `forum_topic_favorite` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `forum_topic_like` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "forum_config" DROP CONSTRAINT "forum_config_updated_by_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_config_history" DROP CONSTRAINT "forum_config_history_operated_by_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_moderator" DROP CONSTRAINT "forum_moderator_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_moderator_application" DROP CONSTRAINT "forum_moderator_application_applicant_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_notification" DROP CONSTRAINT "forum_notification_user_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_profile_badge" DROP CONSTRAINT "forum_profile_badge_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_reply" DROP CONSTRAINT "forum_reply_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_reply_like" DROP CONSTRAINT "forum_reply_like_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_report" DROP CONSTRAINT "forum_report_handler_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_report" DROP CONSTRAINT "forum_report_reporter_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_topic" DROP CONSTRAINT "forum_topic_forum_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_topic" DROP CONSTRAINT "forum_topic_last_reply_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_topic_favorite" DROP CONSTRAINT "forum_topic_favorite_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_topic_like" DROP CONSTRAINT "forum_topic_like_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_user_action_log" DROP CONSTRAINT "forum_user_action_log_user_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_view" DROP CONSTRAINT "forum_view_user_id_fkey";

-- DropIndex
DROP INDEX "forum_moderator_profile_id_key";

-- DropIndex
DROP INDEX "forum_profile_badge_profile_id_badge_id_key";

-- DropIndex
DROP INDEX "forum_profile_badge_profile_id_idx";

-- DropIndex
DROP INDEX "forum_reply_profile_id_idx";

-- DropIndex
DROP INDEX "forum_reply_like_profile_id_idx";

-- DropIndex
DROP INDEX "forum_reply_like_reply_id_profile_id_key";

-- DropIndex
DROP INDEX "forum_topic_profile_id_idx";

-- DropIndex
DROP INDEX "forum_topic_favorite_profile_id_idx";

-- DropIndex
DROP INDEX "forum_topic_favorite_topic_id_profile_id_key";

-- DropIndex
DROP INDEX "forum_topic_like_profile_id_idx";

-- DropIndex
DROP INDEX "forum_topic_like_topic_id_profile_id_key";

-- AlterTable
ALTER TABLE "forum_moderator" DROP COLUMN "profile_id",
ADD COLUMN     "user_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "forum_profile_badge" DROP COLUMN "profile_id",
ADD COLUMN     "user_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "forum_reply" DROP COLUMN "profile_id",
ADD COLUMN     "user_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "forum_reply_like" DROP COLUMN "profile_id",
ADD COLUMN     "user_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "forum_topic" DROP COLUMN "last_reply_profile_id",
DROP COLUMN "profile_id",
ADD COLUMN     "last_reply_user_id" INTEGER,
ADD COLUMN     "user_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "forum_topic_favorite" DROP COLUMN "profile_id",
ADD COLUMN     "user_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "forum_topic_like" DROP COLUMN "profile_id",
ADD COLUMN     "user_id" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "forum_moderator_user_id_key" ON "forum_moderator"("user_id");

-- CreateIndex
CREATE INDEX "forum_profile_badge_user_id_idx" ON "forum_profile_badge"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "forum_profile_badge_user_id_badge_id_key" ON "forum_profile_badge"("user_id", "badge_id");

-- CreateIndex
CREATE INDEX "forum_reply_user_id_idx" ON "forum_reply"("user_id");

-- CreateIndex
CREATE INDEX "forum_reply_like_user_id_idx" ON "forum_reply_like"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "forum_reply_like_reply_id_user_id_key" ON "forum_reply_like"("reply_id", "user_id");

-- CreateIndex
CREATE INDEX "forum_topic_user_id_idx" ON "forum_topic"("user_id");

-- CreateIndex
CREATE INDEX "forum_topic_favorite_user_id_idx" ON "forum_topic_favorite"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "forum_topic_favorite_topic_id_user_id_key" ON "forum_topic_favorite"("topic_id", "user_id");

-- CreateIndex
CREATE INDEX "forum_topic_like_user_id_idx" ON "forum_topic_like"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "forum_topic_like_topic_id_user_id_key" ON "forum_topic_like"("topic_id", "user_id");

-- AddForeignKey
ALTER TABLE "forum_config_history" ADD CONSTRAINT "forum_config_history_operated_by_id_fkey" FOREIGN KEY ("operated_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_config" ADD CONSTRAINT "forum_config_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_moderator_application" ADD CONSTRAINT "forum_moderator_application_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_moderator_application" ADD CONSTRAINT "forum_moderator_application_audit_by_id_fkey" FOREIGN KEY ("audit_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_moderator" ADD CONSTRAINT "forum_moderator_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_notification" ADD CONSTRAINT "forum_notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_profile_badge" ADD CONSTRAINT "forum_profile_badge_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reply_like" ADD CONSTRAINT "forum_reply_like_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reply" ADD CONSTRAINT "forum_reply_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_report" ADD CONSTRAINT "forum_report_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_report" ADD CONSTRAINT "forum_report_handler_id_fkey" FOREIGN KEY ("handler_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic_favorite" ADD CONSTRAINT "forum_topic_favorite_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic_like" ADD CONSTRAINT "forum_topic_like_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic" ADD CONSTRAINT "forum_topic_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic" ADD CONSTRAINT "forum_topic_last_reply_user_id_fkey" FOREIGN KEY ("last_reply_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_user_action_log" ADD CONSTRAINT "forum_user_action_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_view" ADD CONSTRAINT "forum_view_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
