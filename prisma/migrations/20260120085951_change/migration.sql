/*
  Warnings:

  - You are about to drop the column `action_description` on the `forum_user_action_log` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "forum_user_action_log" DROP COLUMN "action_description";
