/*
  Warnings:

  - Made the column `title` on table `client_page` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "client_page" ALTER COLUMN "title" SET NOT NULL;
