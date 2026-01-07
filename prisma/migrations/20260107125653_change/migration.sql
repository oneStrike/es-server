/*
  Warnings:

  - You are about to drop the column `username` on the `client_user` table. All the data in the column will be lost.
  - You are about to drop the column `max_moderators` on the `forum_section` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[account]` on the table `client_user` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `account` to the `client_user` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "client_user_username_key";

-- AlterTable
ALTER TABLE "client_user" DROP COLUMN "username",
ADD COLUMN     "account" VARCHAR(50) NOT NULL;

-- AlterTable
ALTER TABLE "forum_section" DROP COLUMN "max_moderators";

-- CreateIndex
CREATE UNIQUE INDEX "client_user_account_key" ON "client_user"("account");
