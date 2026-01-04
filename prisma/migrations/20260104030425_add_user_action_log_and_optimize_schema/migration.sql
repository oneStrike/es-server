/*
  Warnings:

  - Changed the type of `action_type` on the `forum_moderator_action_log` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `target_type` on the `forum_moderator_action_log` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ModeratorActionType" AS ENUM ('PIN_TOPIC', 'UNPIN_TOPIC', 'FEATURE_TOPIC', 'UNFEATURE_TOPIC', 'LOCK_TOPIC', 'UNLOCK_TOPIC', 'DELETE_TOPIC', 'MOVE_TOPIC', 'AUDIT_TOPIC', 'DELETE_REPLY');

-- CreateEnum
CREATE TYPE "ModeratorTargetType" AS ENUM ('TOPIC', 'REPLY');

-- CreateEnum
CREATE TYPE "UserActionType" AS ENUM ('CREATE_TOPIC', 'CREATE_REPLY', 'LIKE_TOPIC', 'UNLIKE_TOPIC', 'LIKE_REPLY', 'UNLIKE_REPLY', 'FAVORITE_TOPIC', 'UNFAVORITE_TOPIC', 'UPDATE_TOPIC', 'UPDATE_REPLY', 'DELETE_TOPIC', 'DELETE_REPLY');

-- CreateEnum
CREATE TYPE "UserTargetType" AS ENUM ('TOPIC', 'REPLY');

-- DropForeignKey
ALTER TABLE "forum_reply" DROP CONSTRAINT "forum_reply_client_user_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_reply" DROP CONSTRAINT "forum_reply_reply_to_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_reply" DROP CONSTRAINT "forum_reply_user_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_reply_like" DROP CONSTRAINT "forum_reply_like_reply_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_section" DROP CONSTRAINT "forum_section_last_topic_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_topic" DROP CONSTRAINT "forum_topic_section_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_topic" DROP CONSTRAINT "forum_topic_user_id_fkey";

-- AlterTable
ALTER TABLE "forum_level_rule" ALTER COLUMN "required_points" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "forum_moderator_action_log" DROP COLUMN "action_type",
ADD COLUMN     "action_type" "ModeratorActionType" NOT NULL,
DROP COLUMN "target_type",
ADD COLUMN     "target_type" "ModeratorTargetType" NOT NULL;

-- AlterTable
ALTER TABLE "forum_notification" ADD COLUMN     "expired_at" TIMESTAMPTZ(6),
ADD COLUMN     "priority" SMALLINT NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "forum_point_record" ALTER COLUMN "points" SET DATA TYPE BIGINT,
ALTER COLUMN "before_points" SET DATA TYPE BIGINT,
ALTER COLUMN "after_points" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "forum_profile" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "points" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "forum_reply" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "forum_sensitive_word" ADD COLUMN     "level" VARCHAR(10) NOT NULL DEFAULT 'MODERATE',
ADD COLUMN     "matchMode" VARCHAR(10) NOT NULL DEFAULT 'EXACT',
ADD COLUMN     "type" VARCHAR(20) NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "forum_topic" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "forum_user_action_log" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "action_type" "UserActionType" NOT NULL,
    "action_description" VARCHAR(200) NOT NULL,
    "target_type" "UserTargetType" NOT NULL,
    "target_id" INTEGER NOT NULL,
    "before_data" TEXT,
    "after_data" TEXT,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_user_action_log_pkey" PRIMARY KEY ("id")
);

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
CREATE INDEX "forum_moderator_action_log_action_type_idx" ON "forum_moderator_action_log"("action_type");

-- CreateIndex
CREATE INDEX "forum_moderator_action_log_target_type_target_id_idx" ON "forum_moderator_action_log"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "forum_notification_priority_idx" ON "forum_notification"("priority");

-- CreateIndex
CREATE INDEX "forum_notification_expired_at_idx" ON "forum_notification"("expired_at");

-- CreateIndex
CREATE INDEX "forum_notification_user_id_priority_idx" ON "forum_notification"("user_id", "priority");

-- CreateIndex
CREATE INDEX "forum_sensitive_word_type_idx" ON "forum_sensitive_word"("type");

-- CreateIndex
CREATE INDEX "forum_sensitive_word_level_idx" ON "forum_sensitive_word"("level");

-- CreateIndex
CREATE INDEX "forum_sensitive_word_matchMode_idx" ON "forum_sensitive_word"("matchMode");

-- AddForeignKey
ALTER TABLE "forum_reply_like" ADD CONSTRAINT "forum_reply_like_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "forum_reply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reply" ADD CONSTRAINT "forum_reply_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "client_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reply" ADD CONSTRAINT "forum_reply_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "forum_reply"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_section" ADD CONSTRAINT "forum_section_last_topic_id_fkey" FOREIGN KEY ("last_topic_id") REFERENCES "forum_topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic" ADD CONSTRAINT "forum_topic_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "forum_section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
