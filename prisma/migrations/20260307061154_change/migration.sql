/*
  Warnings:

  - You are about to drop the column `business` on the `user_point_rule` table. All the data in the column will be lost.
  - You are about to drop the column `cooldown_seconds` on the `user_point_rule` table. All the data in the column will be lost.
  - You are about to drop the column `event_key` on the `user_point_rule` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "user_point_rule" DROP COLUMN "business",
DROP COLUMN "cooldown_seconds",
DROP COLUMN "event_key";
