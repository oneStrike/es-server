/*
  Warnings:

  - You are about to drop the column `download_points` on the `work_chapter` table. All the data in the column will be lost.
  - You are about to drop the column `download_rule` on the `work_chapter` table. All the data in the column will be lost.
  - You are about to drop the column `read_points` on the `work_chapter` table. All the data in the column will be lost.
  - You are about to drop the column `required_download_level_id` on the `work_chapter` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "work" DROP CONSTRAINT "work_required_download_level_id_fkey";

-- DropForeignKey
ALTER TABLE "work_chapter" DROP CONSTRAINT "work_chapter_required_download_level_id_fkey";

-- DropIndex
DROP INDEX "work_required_download_level_id_idx";

-- DropIndex
DROP INDEX "work_chapter_required_download_level_id_idx";

-- AlterTable
ALTER TABLE "app_user" ADD COLUMN     "balance" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "work" ADD COLUMN     "price" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "purchase_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "work_chapter" DROP COLUMN "download_points",
DROP COLUMN "download_rule",
DROP COLUMN "read_points",
DROP COLUMN "required_download_level_id",
ADD COLUMN     "can_download" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "price" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "app_user_balance_idx" ON "app_user"("balance");

-- CreateIndex
CREATE INDEX "work_price_idx" ON "work"("price");
