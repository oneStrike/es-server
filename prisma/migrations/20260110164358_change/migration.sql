/*
  Warnings:

  - You are about to drop the column `level_badge` on the `forum_level_rule` table. All the data in the column will be lost.
  - You are about to drop the column `level_color` on the `forum_level_rule` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "dictionary_item" ALTER COLUMN "order" DROP NOT NULL;

-- AlterTable
ALTER TABLE "forum_level_rule" DROP COLUMN "level_badge",
DROP COLUMN "level_color",
ADD COLUMN     "badge" VARCHAR(255),
ADD COLUMN     "color" VARCHAR(20);
