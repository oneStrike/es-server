/*
  Warnings:

  - You are about to drop the column `matchMode` on the `forum_sensitive_word` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "forum_sensitive_word_matchMode_idx";

-- AlterTable
ALTER TABLE "forum_sensitive_word" DROP COLUMN "matchMode";
