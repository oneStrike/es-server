/*
  Warnings:

  - You are about to drop the column `account` on the `app_user` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "app_user_account_key";

-- AlterTable
ALTER TABLE "app_user" DROP COLUMN "account";
