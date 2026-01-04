/*
  Warnings:

  - You are about to drop the column `is_banned` on the `forum_profile` table. All the data in the column will be lost.
  - You are about to drop the column `last_post_at` on the `forum_profile` table. All the data in the column will be lost.
  - You are about to drop the column `last_visit_at` on the `forum_profile` table. All the data in the column will be lost.
  - You are about to drop the column `version` on the `forum_profile` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `forum_point_rule` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[type]` on the table `forum_point_rule` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "forum_profile_deleted_at_idx";

-- DropIndex
DROP INDEX "forum_profile_is_banned_idx";

-- DropIndex
DROP INDEX "forum_profile_last_post_at_idx";

-- DropIndex
DROP INDEX "forum_profile_last_visit_at_idx";

-- AlterTable
ALTER TABLE "forum_profile" DROP COLUMN "is_banned",
DROP COLUMN "last_post_at",
DROP COLUMN "last_visit_at",
DROP COLUMN "version",
ADD COLUMN     "status" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "forum_point_rule_name_key" ON "forum_point_rule"("name");

-- CreateIndex
CREATE UNIQUE INDEX "forum_point_rule_type_key" ON "forum_point_rule"("type");

-- CreateIndex
CREATE INDEX "forum_profile_status_idx" ON "forum_profile"("status");
