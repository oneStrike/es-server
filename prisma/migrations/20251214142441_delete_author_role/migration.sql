/*
  Warnings:

  - You are about to drop the column `featured` on the `work_author` table. All the data in the column will be lost.
  - You are about to drop the `work_author_role` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `work_author_role_type` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "work_author_featured_works_count_idx";

-- DropIndex
DROP INDEX "work_author_is_enabled_featured_idx";

-- AlterTable
ALTER TABLE "work_author" DROP COLUMN "featured",
ADD COLUMN     "is_recommended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "type" SMALLINT NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "work_author_role";

-- DropTable
DROP TABLE "work_author_role_type";

-- CreateIndex
CREATE INDEX "work_author_type_idx" ON "work_author"("type");

-- CreateIndex
CREATE INDEX "work_author_is_enabled_is_recommended_idx" ON "work_author"("is_enabled", "is_recommended");

-- CreateIndex
CREATE INDEX "work_author_is_recommended_works_count_idx" ON "work_author"("is_recommended", "works_count" DESC);
