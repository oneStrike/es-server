/*
  Warnings:

  - You are about to drop the column `audit_by` on the `forum_reply` table. All the data in the column will be lost.
  - You are about to drop the column `audit_by` on the `forum_topic` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "forum_reply" DROP COLUMN "audit_by",
ADD COLUMN     "audit_by_profile_id" INTEGER;

-- AlterTable
ALTER TABLE "forum_topic" DROP COLUMN "audit_by",
ADD COLUMN     "audit_by_profile_id" INTEGER;
