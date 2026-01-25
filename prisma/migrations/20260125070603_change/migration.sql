/*
  Warnings:

  - A unique constraint covering the columns `[account]` on the table `app_user` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `account` to the `app_user` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "app_user" ADD COLUMN     "account" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "app_user_account_key" ON "app_user"("account");
