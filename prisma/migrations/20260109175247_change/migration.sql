/*
  Warnings:

  - You are about to drop the column `user_id` on the `forum_moderator` table. All the data in the column will be lost.
  - You are about to drop the column `audit_by` on the `forum_moderator_application` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `forum_reply` table. All the data in the column will be lost.
  - You are about to drop the column `last_reply_user_id` on the `forum_topic` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `forum_topic` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[profile_id]` on the table `forum_moderator` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `profile_id` to the `forum_moderator` table without a default value. This is not possible if the table is not empty.
  - Added the required column `profile_id` to the `forum_reply` table without a default value. This is not possible if the table is not empty.
  - Added the required column `profile_id` to the `forum_topic` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "forum_moderator" DROP CONSTRAINT "forum_moderator_user_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_reply" DROP CONSTRAINT "forum_reply_user_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_topic" DROP CONSTRAINT "forum_topic_client_user_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_topic" DROP CONSTRAINT "forum_topic_last_reply_user_id_fkey";

-- DropIndex
DROP INDEX "forum_moderator_user_id_key";

-- DropIndex
DROP INDEX "forum_moderator_application_audit_by_idx";

-- DropIndex
DROP INDEX "forum_reply_user_id_idx";

-- DropIndex
DROP INDEX "forum_topic_user_id_idx";

-- AlterTable
ALTER TABLE "forum_moderator" DROP COLUMN "user_id",
ADD COLUMN     "profile_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "forum_moderator_application" DROP COLUMN "audit_by",
ADD COLUMN     "audit_by_profile_id" INTEGER;

-- AlterTable
ALTER TABLE "forum_reply" DROP COLUMN "user_id",
ADD COLUMN     "profile_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "forum_topic" DROP COLUMN "last_reply_user_id",
DROP COLUMN "user_id",
ADD COLUMN     "last_reply_profile_id" INTEGER,
ADD COLUMN     "profile_id" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "forum_moderator_profile_id_key" ON "forum_moderator"("profile_id");

-- CreateIndex
CREATE INDEX "forum_moderator_application_audit_by_profile_id_idx" ON "forum_moderator_application"("audit_by_profile_id");

-- CreateIndex
CREATE INDEX "forum_reply_profile_id_idx" ON "forum_reply"("profile_id");

-- CreateIndex
CREATE INDEX "forum_topic_profile_id_idx" ON "forum_topic"("profile_id");

-- AddForeignKey
ALTER TABLE "forum_moderator" ADD CONSTRAINT "forum_moderator_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "forum_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reply" ADD CONSTRAINT "forum_reply_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "forum_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic" ADD CONSTRAINT "forum_topic_forum_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "forum_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topic" ADD CONSTRAINT "forum_topic_last_reply_profile_id_fkey" FOREIGN KEY ("last_reply_profile_id") REFERENCES "forum_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
