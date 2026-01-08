/*
  Warnings:

  - You are about to alter the column `audit_by` on the `forum_audit_log` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `SmallInt`.
  - Added the required column `audit_role` to the `forum_audit_log` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "forum_audit_log" ADD COLUMN     "audit_role" SMALLINT NOT NULL,
ALTER COLUMN "audit_by" SET DATA TYPE SMALLINT;
