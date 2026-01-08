/*
  Warnings:

  - You are about to drop the column `audit_at` on the `forum_audit_log` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "forum_audit_log_audit_at_idx";

-- AlterTable
ALTER TABLE "forum_audit_log" DROP COLUMN "audit_at",
ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "forum_audit_log_created_at_idx" ON "forum_audit_log"("created_at");
