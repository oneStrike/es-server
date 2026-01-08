/*
  Warnings:

  - You are about to drop the column `order` on the `forum_badge` table. All the data in the column will be lost.
  - You are about to drop the column `order` on the `forum_level_rule` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "forum_badge_order_idx";

-- DropIndex
DROP INDEX "forum_level_rule_is_enabled_order_idx";

-- AlterTable
ALTER TABLE "forum_badge" DROP COLUMN "order",
ADD COLUMN     "sortOrder" SMALLINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "forum_level_rule" DROP COLUMN "order",
ADD COLUMN     "sortOrder" SMALLINT NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "forum_badge_sortOrder_idx" ON "forum_badge"("sortOrder");

-- CreateIndex
CREATE INDEX "forum_level_rule_is_enabled_sortOrder_idx" ON "forum_level_rule"("is_enabled", "sortOrder");
