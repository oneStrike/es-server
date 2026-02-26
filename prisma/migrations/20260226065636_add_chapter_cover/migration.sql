/*
  Warnings:

  - You are about to drop the column `role` on the `work_author_relation` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "work_author_relation" DROP COLUMN "role";

-- AlterTable
ALTER TABLE "work_chapter" ADD COLUMN     "cover" VARCHAR(500);
