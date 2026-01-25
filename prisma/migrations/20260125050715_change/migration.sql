/*
  Warnings:

  - You are about to drop the column `is_active` on the `app_user_token` table. All the data in the column will be lost.
  - You are about to drop the column `last_used_at` on the `app_user_token` table. All the data in the column will be lost.
  - You are about to drop the column `token` on the `app_user_token` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "app_user_token_is_active_idx";

-- DropIndex
DROP INDEX "app_user_token_user_id_is_active_idx";

-- AlterTable
ALTER TABLE "app_user_token" DROP COLUMN "is_active",
DROP COLUMN "last_used_at",
DROP COLUMN "token";
