/*
  Warnings:

  - You are about to drop the column `level_rule_id` on the `forum_section` table. All the data in the column will be lost.
  - Added the required column `updated_at` to the `forum_moderator_section` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "forum_section" DROP CONSTRAINT "forum_section_level_rule_id_fkey";

-- AlterTable
ALTER TABLE "forum_moderator_section" ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL;

-- AlterTable
ALTER TABLE "forum_section" DROP COLUMN "level_rule_id",
ADD COLUMN     "user_level_rule_id" INTEGER,
ALTER COLUMN "topic_review_policy" SET DEFAULT 1;

-- RenameForeignKey
ALTER TABLE "forum_section" RENAME CONSTRAINT "fk_forum_section_parent" TO "forum_section_parent_id_fkey";

-- AddForeignKey
ALTER TABLE "forum_section" ADD CONSTRAINT "forum_section_user_level_rule_id_fkey" FOREIGN KEY ("user_level_rule_id") REFERENCES "forum_level_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_forum_section_level" RENAME TO "forum_section_level_idx";

-- RenameIndex
ALTER INDEX "idx_forum_section_parent_id" RENAME TO "forum_section_parent_id_idx";
