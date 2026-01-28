/*
  Warnings:

  - You are about to drop the column `type` on the `app_agreement` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "app_agreement" DROP COLUMN "type",
ADD COLUMN     "show_in_auth" BOOLEAN NOT NULL DEFAULT false;
