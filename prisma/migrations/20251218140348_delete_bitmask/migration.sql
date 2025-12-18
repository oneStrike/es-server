/*
  Warnings:

  - The `enable_platform` column on the `client_notice` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `enable_platform` column on the `client_page` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `type` column on the `work_author` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "client_notice" DROP COLUMN "enable_platform",
ADD COLUMN     "enable_platform" INTEGER[];

-- AlterTable
ALTER TABLE "client_page" DROP COLUMN "enable_platform",
ADD COLUMN     "enable_platform" INTEGER[];

-- AlterTable
ALTER TABLE "work_author" DROP COLUMN "type",
ADD COLUMN     "type" INTEGER[];

-- CreateIndex
CREATE INDEX "work_author_type_idx" ON "work_author"("type");
