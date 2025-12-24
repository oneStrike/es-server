/*
  Warnings:

  - You are about to drop the column `is_primary` on the `work_comic_category` table. All the data in the column will be lost.
  - You are about to drop the column `weight` on the `work_comic_category` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "work_comic_category_category_id_is_primary_idx";

-- DropIndex
DROP INDEX "work_comic_category_comic_id_weight_idx";

-- DropIndex
DROP INDEX "work_comic_category_is_primary_idx";

-- DropIndex
DROP INDEX "work_comic_category_weight_idx";

-- AlterTable
ALTER TABLE "work_comic_author" ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "work_comic_category" DROP COLUMN "is_primary",
DROP COLUMN "weight",
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "work_comic_tag" ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "work_comic_category_sort_order_idx" ON "work_comic_category"("sort_order");

-- CreateIndex
CREATE INDEX "work_comic_category_comic_id_sort_order_idx" ON "work_comic_category"("comic_id", "sort_order");

-- CreateIndex
CREATE INDEX "work_comic_tag_sort_order_idx" ON "work_comic_tag"("sort_order");

-- CreateIndex
CREATE INDEX "work_comic_tag_comic_id_sort_order_idx" ON "work_comic_tag"("comic_id", "sort_order");
