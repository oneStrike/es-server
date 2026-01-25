/*
  Warnings:

  - Made the column `nickname` on table `app_user` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "app_user" ALTER COLUMN "nickname" SET NOT NULL;
