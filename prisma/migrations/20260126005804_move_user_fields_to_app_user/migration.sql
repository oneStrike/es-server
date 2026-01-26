/*
  Warnings:

  - You are about to drop the column `is_signed_in` on the `app_user` table. All the data in the column will be lost.
  - You are about to drop the column `ban_reason` on the `forum_profile` table. All the data in the column will be lost.
  - You are about to drop the column `ban_until` on the `forum_profile` table. All the data in the column will be lost.
  - You are about to drop the column `experience` on the `forum_profile` table. All the data in the column will be lost.
  - You are about to drop the column `level_id` on the `forum_profile` table. All the data in the column will be lost.
  - You are about to drop the column `points` on the `forum_profile` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `forum_profile` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "forum_experience_record" DROP CONSTRAINT "forum_experience_record_user_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_point_record" DROP CONSTRAINT "forum_point_record_user_id_fkey";

-- DropForeignKey
ALTER TABLE "forum_profile" DROP CONSTRAINT "forum_profile_level_id_fkey";

-- DropIndex
DROP INDEX "forum_profile_level_id_idx";

-- DropIndex
DROP INDEX "forum_profile_points_idx";

-- DropIndex
DROP INDEX "forum_profile_status_idx";

-- AlterTable
ALTER TABLE "app_user" DROP COLUMN "is_signed_in",
ADD COLUMN     "ban_reason" VARCHAR(500),
ADD COLUMN     "ban_until" TIMESTAMPTZ(6),
ADD COLUMN     "experience" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "level_id" INTEGER,
ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "forum_profile" DROP COLUMN "ban_reason",
DROP COLUMN "ban_until",
DROP COLUMN "experience",
DROP COLUMN "level_id",
DROP COLUMN "points",
DROP COLUMN "status";

-- CreateIndex
CREATE INDEX "app_user_points_idx" ON "app_user"("points");

-- CreateIndex
CREATE INDEX "app_user_status_idx" ON "app_user"("status");

-- CreateIndex
CREATE INDEX "app_user_level_id_idx" ON "app_user"("level_id");

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "forum_level_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_experience_record" ADD CONSTRAINT "forum_experience_record_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_point_record" ADD CONSTRAINT "forum_point_record_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
