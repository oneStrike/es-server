/*
  Warnings:

  - You are about to drop the column `comment_rate_limit_config` on the `sys_config` table. All the data in the column will be lost.
  - You are about to drop the column `growth_antifraud_config` on the `sys_config` table. All the data in the column will be lost.
  - You are about to drop the column `notify_config` on the `sys_config` table. All the data in the column will be lost.
  - You are about to drop the column `register_config` on the `sys_config` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "sys_config" DROP COLUMN "comment_rate_limit_config",
DROP COLUMN "growth_antifraud_config",
DROP COLUMN "notify_config",
DROP COLUMN "register_config";
