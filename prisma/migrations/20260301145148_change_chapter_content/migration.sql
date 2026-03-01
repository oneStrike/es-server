/*
  Warnings:

  - You are about to drop the column `content_path` on the `work_chapter` table. All the data in the column will be lost.
  - You are about to drop the column `read_rule` on the `work_chapter` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "work_chapter_read_rule_idx";

-- AlterTable
ALTER TABLE "work_chapter" DROP COLUMN "content_path",
DROP COLUMN "read_rule",
ADD COLUMN     "content" TEXT,
ADD COLUMN     "view_rule" SMALLINT NOT NULL DEFAULT -1;

-- CreateIndex
CREATE INDEX "work_chapter_view_rule_idx" ON "work_chapter"("view_rule");
