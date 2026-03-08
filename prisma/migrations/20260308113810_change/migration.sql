/*
  Warnings:

  - You are about to drop the `user_comment_like` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_comment_like" DROP CONSTRAINT "user_comment_like_comment_id_fkey";

-- DropForeignKey
ALTER TABLE "user_comment_like" DROP CONSTRAINT "user_comment_like_user_id_fkey";

-- DropTable
DROP TABLE "user_comment_like";
