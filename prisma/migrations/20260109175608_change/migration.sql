/*
  Warnings:

  - You are about to drop the column `audit_by_profile_id` on the `forum_moderator_application` table. All the data in the column will be lost.
  - You are about to drop the column `audit_by_profile_id` on the `forum_reply` table. All the data in the column will be lost.
  - You are about to drop the column `audit_by_profile_id` on the `forum_topic` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "forum_moderator_application_audit_by_profile_id_idx";

-- AlterTable
ALTER TABLE "forum_moderator_application" DROP COLUMN "audit_by_profile_id",
ADD COLUMN     "audit_by_id" INTEGER;

-- AlterTable
ALTER TABLE "forum_reply" DROP COLUMN "audit_by_profile_id",
ADD COLUMN     "audit_by_id" INTEGER;

-- AlterTable
ALTER TABLE "forum_topic" DROP COLUMN "audit_by_profile_id",
ADD COLUMN     "audit_by_id" INTEGER;

-- CreateIndex
CREATE INDEX "forum_moderator_application_audit_by_id_idx" ON "forum_moderator_application"("audit_by_id");
