/*
  Warnings:

  - The `level` column on the `forum_sensitive_word` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `matchMode` column on the `forum_sensitive_word` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `type` column on the `forum_sensitive_word` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `action_type` on the `forum_moderator_action_log` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `target_type` on the `forum_moderator_action_log` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `action_type` on the `forum_user_action_log` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `target_type` on the `forum_user_action_log` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "forum_audit_log" DROP CONSTRAINT "forum_audit_log_reply_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_audit_log" DROP CONSTRAINT "forum_audit_log_topic_id_fkey";

-- AlterTable
ALTER TABLE "forum_moderator_action_log" DROP COLUMN "action_type",
ADD COLUMN     "action_type" SMALLINT NOT NULL,
DROP COLUMN "target_type",
ADD COLUMN     "target_type" SMALLINT NOT NULL;

-- AlterTable
ALTER TABLE "forum_sensitive_word" DROP COLUMN "level",
ADD COLUMN     "level" SMALLINT NOT NULL DEFAULT 2,
DROP COLUMN "matchMode",
ADD COLUMN     "matchMode" SMALLINT NOT NULL DEFAULT 1,
DROP COLUMN "type",
ADD COLUMN     "type" SMALLINT NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "forum_user_action_log" DROP COLUMN "action_type",
ADD COLUMN     "action_type" SMALLINT NOT NULL,
DROP COLUMN "target_type",
ADD COLUMN     "target_type" SMALLINT NOT NULL;

-- DropEnum
DROP TYPE "ModeratorActionType";

-- DropEnum
DROP TYPE "ModeratorTargetType";

-- DropEnum
DROP TYPE "UserActionType";

-- DropEnum
DROP TYPE "UserTargetType";

-- CreateIndex
CREATE INDEX "forum_moderator_action_log_action_type_idx" ON "forum_moderator_action_log"("action_type");

-- CreateIndex
CREATE INDEX "forum_moderator_action_log_target_type_target_id_idx" ON "forum_moderator_action_log"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "forum_sensitive_word_type_idx" ON "forum_sensitive_word"("type");

-- CreateIndex
CREATE INDEX "forum_sensitive_word_level_idx" ON "forum_sensitive_word"("level");

-- CreateIndex
CREATE INDEX "forum_sensitive_word_matchMode_idx" ON "forum_sensitive_word"("matchMode");

-- CreateIndex
CREATE INDEX "forum_user_action_log_action_type_idx" ON "forum_user_action_log"("action_type");

-- CreateIndex
CREATE INDEX "forum_user_action_log_target_type_target_id_idx" ON "forum_user_action_log"("target_type", "target_id");
