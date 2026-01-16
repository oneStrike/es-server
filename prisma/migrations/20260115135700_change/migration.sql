/*
  Warnings:

  - You are about to drop the column `name` on the `forum_experience_rule` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "forum_experience_rule_name_key";

-- AlterTable
ALTER TABLE "forum_experience_rule" DROP COLUMN "name";
