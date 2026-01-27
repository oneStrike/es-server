/*
  Warnings:

  - You are about to drop the column `popularity_weight` on the `work_category` table. All the data in the column will be lost.
  - You are about to drop the column `popularity_weight` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `popularity_weight` on the `work_tag` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "work_comic_popularity_popularity_weight_idx";

-- AlterTable
ALTER TABLE "work_category" DROP COLUMN "popularity_weight";

-- AlterTable
ALTER TABLE "work_comic" DROP COLUMN "popularity_weight";

-- AlterTable
ALTER TABLE "work_tag" DROP COLUMN "popularity_weight";

-- CreateIndex
CREATE INDEX "work_comic_popularity_idx" ON "work_comic"("popularity");
