/*
  Warnings:

  - You are about to drop the column `cover` on the `forum_section` table. All the data in the column will be lost.
  - You are about to drop the column `reply_count` on the `forum_section` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "forum_section_reply_count_idx";

-- AlterTable
ALTER TABLE "forum_section" DROP COLUMN "cover",
DROP COLUMN "reply_count",
ADD COLUMN     "level_rule_id" INTEGER,
ADD COLUMN     "remark" VARCHAR(500),
ADD COLUMN     "topic_review_policy" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "forum_section" ADD CONSTRAINT "forum_section_level_rule_id_fkey" FOREIGN KEY ("level_rule_id") REFERENCES "forum_level_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
