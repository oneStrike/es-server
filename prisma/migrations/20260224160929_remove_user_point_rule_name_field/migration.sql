/*
  Warnings:

  - You are about to drop the column `name` on the `user_point_rule` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "user_point_rule_name_key";

-- AlterTable
ALTER TABLE "user_point_rule" DROP COLUMN "name";
