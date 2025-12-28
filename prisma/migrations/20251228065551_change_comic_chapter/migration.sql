/*
  Warnings:

  - You are about to drop the column `can_download` on the `work_comic_chapter` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "work_comic_chapter" DROP COLUMN "can_download",
ADD COLUMN     "download_rule" SMALLINT NOT NULL DEFAULT 1;
