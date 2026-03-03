/*
  Warnings:

  - You are about to drop the column `order` on the `work_category` table. All the data in the column will be lost.
  - You are about to drop the column `order` on the `work_tag` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "work_category_order_idx";

-- DropIndex
DROP INDEX "work_tag_order_idx";

-- AlterTable
ALTER TABLE "work_category" DROP COLUMN "order",
ADD COLUMN     "sort_order" SMALLINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "work_tag" DROP COLUMN "order",
ADD COLUMN     "sort_order" SMALLINT NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "work_category_sort_order_idx" ON "work_category"("sort_order");

-- CreateIndex
CREATE INDEX "work_tag_sort_order_idx" ON "work_tag"("sort_order");
