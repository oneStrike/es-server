/*
  Warnings:

  - You are about to drop the column `floor` on the `forum_reply` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "forum_reply_floor_idx";

-- DropIndex
DROP INDEX "forum_reply_topic_id_floor_idx";

-- AlterTable
ALTER TABLE "forum_reply" DROP COLUMN "floor";
