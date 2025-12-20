/*
  Warnings:

  - You are about to drop the column `chapter_number` on the `work_comic_chapter` table. All the data in the column will be lost.
  - You are about to drop the column `version_id` on the `work_comic_chapter` table. All the data in the column will be lost.
  - You are about to drop the `work_comic_version` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[sort_order]` on the table `work_comic_chapter` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[comic_id,sort_order]` on the table `work_comic_chapter` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "work_comic_chapter_comic_id_chapter_number_idx";

-- DropIndex
DROP INDEX "work_comic_chapter_comic_id_version_id_chapter_number_key";

-- DropIndex
DROP INDEX "work_comic_chapter_comic_id_version_id_idx";

-- DropIndex
DROP INDEX "work_comic_chapter_version_id_chapter_number_idx";

-- DropIndex
DROP INDEX "work_comic_chapter_version_id_idx";

-- AlterTable
ALTER TABLE "work_comic" ADD COLUMN     "favorite_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "like_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "work_comic_chapter" DROP COLUMN "chapter_number",
DROP COLUMN "version_id",
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "work_comic_version";

-- CreateIndex
CREATE INDEX "work_comic_like_count_idx" ON "work_comic"("like_count");

-- CreateIndex
CREATE INDEX "work_comic_favorite_count_idx" ON "work_comic"("favorite_count");

-- CreateIndex
CREATE UNIQUE INDEX "work_comic_chapter_sort_order_key" ON "work_comic_chapter"("sort_order");

-- CreateIndex
CREATE INDEX "work_comic_chapter_comic_id_sort_order_idx" ON "work_comic_chapter"("comic_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "work_comic_chapter_comic_id_sort_order_key" ON "work_comic_chapter"("comic_id", "sort_order");
