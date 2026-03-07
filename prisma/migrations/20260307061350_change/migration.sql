/*
  Warnings:

  - You are about to drop the column `event_id` on the `user_experience_record` table. All the data in the column will be lost.
  - You are about to drop the column `business` on the `user_experience_rule` table. All the data in the column will be lost.
  - You are about to drop the column `cooldown_seconds` on the `user_experience_rule` table. All the data in the column will be lost.
  - You are about to drop the column `event_key` on the `user_experience_rule` table. All the data in the column will be lost.
  - You are about to drop the column `event_id` on the `user_point_record` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_experience_record" DROP CONSTRAINT "user_experience_record_event_id_fkey";

-- DropForeignKey
ALTER TABLE "user_point_record" DROP CONSTRAINT "user_point_record_event_id_fkey";

-- DropIndex
DROP INDEX "user_experience_record_event_id_idx";

-- DropIndex
DROP INDEX "user_point_record_event_id_idx";

-- AlterTable
ALTER TABLE "user_experience_record" DROP COLUMN "event_id";

-- AlterTable
ALTER TABLE "user_experience_rule" DROP COLUMN "business",
DROP COLUMN "cooldown_seconds",
DROP COLUMN "event_key";

-- AlterTable
ALTER TABLE "user_point_record" DROP COLUMN "event_id";
