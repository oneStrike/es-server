/*
  Warnings:

  - Made the column `level_id` on table `forum_profile` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "forum_profile" DROP CONSTRAINT "forum_profile_level_id_fkey";

-- AlterTable
ALTER TABLE "forum_profile" ALTER COLUMN "level_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "forum_profile" ADD CONSTRAINT "forum_profile_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "forum_level_rule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
