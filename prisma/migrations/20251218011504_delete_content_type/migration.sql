/*
  Warnings:

  - You are about to drop the `work_category_content_type` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `work_content_type` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "work_category" ADD COLUMN     "content_type" SMALLINT;

-- DropTable
DROP TABLE "work_category_content_type";

-- DropTable
DROP TABLE "work_content_type";

-- CreateIndex
CREATE INDEX "work_category_content_type_idx" ON "work_category"("content_type");
