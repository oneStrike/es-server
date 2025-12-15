/*
  Warnings:

  - You are about to drop the column `seo_description` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `seo_keywords` on the `work_comic` table. All the data in the column will be lost.
  - You are about to drop the column `seo_title` on the `work_comic` table. All the data in the column will be lost.
  - The `can_download` column on the `work_comic` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "work_comic" DROP COLUMN "seo_description",
DROP COLUMN "seo_keywords",
DROP COLUMN "seo_title",
DROP COLUMN "can_download",
ADD COLUMN     "can_download" SMALLINT NOT NULL DEFAULT 1;
