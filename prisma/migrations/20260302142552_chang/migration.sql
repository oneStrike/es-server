/*
  Warnings:

  - You are about to drop the column `balance` on the `app_user` table. All the data in the column will be lost.
  - You are about to drop the column `can_download` on the `work` table. All the data in the column will be lost.
  - You are about to drop the column `can_exchange` on the `work` table. All the data in the column will be lost.
  - You are about to drop the column `chapter_exchange_points` on the `work` table. All the data in the column will be lost.
  - You are about to drop the column `exchange_points` on the `work` table. All the data in the column will be lost.
  - You are about to drop the column `can_exchange` on the `work_chapter` table. All the data in the column will be lost.
  - You are about to drop the column `exchange_points` on the `work_chapter` table. All the data in the column will be lost.
  - You are about to drop the `user_balance_record` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_balance_record" DROP CONSTRAINT "user_balance_record_user_id_fkey";

-- DropIndex
DROP INDEX "app_user_balance_idx";

-- AlterTable
ALTER TABLE "app_user" DROP COLUMN "balance";

-- AlterTable
ALTER TABLE "work" DROP COLUMN "can_download",
DROP COLUMN "can_exchange",
DROP COLUMN "chapter_exchange_points",
DROP COLUMN "exchange_points";

-- AlterTable
ALTER TABLE "work_chapter" DROP COLUMN "can_exchange",
DROP COLUMN "exchange_points";

-- DropTable
DROP TABLE "user_balance_record";
