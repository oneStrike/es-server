/*
  Warnings:

  - You are about to drop the column `read_count` on the `client_notice` table. All the data in the column will be lost.
  - Added the required column `enable_platform` to the `client_page` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "client_notice_read_count_idx";

-- AlterTable
ALTER TABLE "client_notice" DROP COLUMN "read_count";

-- AlterTable
ALTER TABLE "client_page" ADD COLUMN     "enable_platform" INTEGER NOT NULL;
