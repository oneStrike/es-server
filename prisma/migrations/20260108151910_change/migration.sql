/*
  Warnings:

  - You are about to drop the `forum_audit_log` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "forum_reply" ADD COLUMN     "audit_role" SMALLINT;

-- AlterTable
ALTER TABLE "forum_topic" ADD COLUMN     "audit_role" SMALLINT;

-- DropTable
DROP TABLE "forum_audit_log";
