/*
  Warnings:

  - The `content_type` column on the `work_category` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "work_category" DROP COLUMN "content_type",
ADD COLUMN     "content_type" INTEGER[];

-- CreateIndex
CREATE INDEX "work_category_content_type_idx" ON "work_category"("content_type");
