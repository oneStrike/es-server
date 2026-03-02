/*
  Warnings:

  - You are about to drop the column `price` on the `work` table. All the data in the column will be lost.
  - You are about to drop the column `purchase_count` on the `work` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "work_price_idx";

-- AlterTable
ALTER TABLE "work" DROP COLUMN "price",
DROP COLUMN "purchase_count";
