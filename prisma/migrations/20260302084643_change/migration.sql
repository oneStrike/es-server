/*
  Warnings:

  - You are about to drop the column `works_count` on the `work_author` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "work_author_is_recommended_works_count_idx";

-- AlterTable
ALTER TABLE "work_author" DROP COLUMN "works_count",
ADD COLUMN     "work_count" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "work_author_is_recommended_work_count_idx" ON "work_author"("is_recommended", "work_count" DESC);
