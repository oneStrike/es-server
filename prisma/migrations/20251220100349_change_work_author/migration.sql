/*
  Warnings:

  - You are about to drop the column `is_primary` on the `work_comic_author` table. All the data in the column will be lost.
  - You are about to drop the column `role_type` on the `work_comic_author` table. All the data in the column will be lost.
  - You are about to drop the column `sort_order` on the `work_comic_author` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "work_comic_author_is_primary_idx";

-- DropIndex
DROP INDEX "work_comic_author_role_type_idx";

-- DropIndex
DROP INDEX "work_comic_author_sort_order_idx";

-- AlterTable
ALTER TABLE "work_comic_author" DROP COLUMN "is_primary",
DROP COLUMN "role_type",
DROP COLUMN "sort_order";
