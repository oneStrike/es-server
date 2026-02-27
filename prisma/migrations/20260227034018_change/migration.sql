/*
  Warnings:

  - You are about to drop the column `download_points` on the `work` table. All the data in the column will be lost.
  - You are about to drop the column `download_rule` on the `work` table. All the data in the column will be lost.
  - You are about to drop the column `required_download_level_id` on the `work` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "work" DROP COLUMN "download_points",
DROP COLUMN "download_rule",
DROP COLUMN "required_download_level_id",
ADD COLUMN     "can_download" BOOLEAN NOT NULL DEFAULT false;
