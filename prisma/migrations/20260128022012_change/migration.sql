/*
  Warnings:

  - The `type` column on the `app_agreement` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[title,version]` on the table `app_agreement` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "app_agreement_type_is_published_idx";

-- DropIndex
DROP INDEX "app_agreement_type_version_key";

-- AlterTable
ALTER TABLE "app_agreement" DROP COLUMN "type",
ADD COLUMN     "type" SMALLINT NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "app_agreement_title_is_published_idx" ON "app_agreement"("title", "is_published");

-- CreateIndex
CREATE UNIQUE INDEX "app_agreement_title_version_key" ON "app_agreement"("title", "version");
