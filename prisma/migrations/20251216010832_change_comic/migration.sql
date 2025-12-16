/*
  Warnings:

  - You are about to drop the column `purchase_amount` on the `work_comic` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "work_comic" DROP COLUMN "purchase_amount",
ADD COLUMN     "download_points" INTEGER DEFAULT 0,
ADD COLUMN     "read_points" INTEGER DEFAULT 0;
