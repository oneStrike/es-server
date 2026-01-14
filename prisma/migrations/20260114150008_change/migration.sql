/*
  Warnings:

  - You are about to drop the column `daily_comment_limit` on the `forum_level_rule` table. All the data in the column will be lost.
  - You are about to drop the column `daily_reply_limit` on the `forum_level_rule` table. All the data in the column will be lost.
  - You are about to drop the column `max_file_size` on the `forum_level_rule` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "forum_level_rule" DROP COLUMN "daily_comment_limit",
DROP COLUMN "daily_reply_limit",
DROP COLUMN "max_file_size",
ADD COLUMN     "daily_reply_comment_limit" SMALLINT NOT NULL DEFAULT 0;
