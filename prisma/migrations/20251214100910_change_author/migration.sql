/*
  Warnings:

  - You are about to drop the column `social_links` on the `work_author` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "work_author_deleted_at_idx";

-- AlterTable
ALTER TABLE "work_author" DROP COLUMN "social_links";
