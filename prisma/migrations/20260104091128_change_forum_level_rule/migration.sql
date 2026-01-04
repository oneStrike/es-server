-- DropIndex
DROP INDEX "forum_level_rule_is_enabled_idx";

-- DropIndex
DROP INDEX "forum_level_rule_order_idx";

-- DropIndex
DROP INDEX "forum_level_rule_required_points_idx";

-- AlterTable
ALTER TABLE "client_user" ADD COLUMN     "is_signed_in" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "forum_level_rule" ADD COLUMN     "daily_comment_limit" SMALLINT NOT NULL DEFAULT 0,
ADD COLUMN     "daily_favorite_limit" SMALLINT NOT NULL DEFAULT 0,
ADD COLUMN     "daily_like_limit" SMALLINT NOT NULL DEFAULT 0,
ADD COLUMN     "daily_reply_limit" SMALLINT NOT NULL DEFAULT 0,
ADD COLUMN     "daily_topic_limit" SMALLINT NOT NULL DEFAULT 0,
ADD COLUMN     "level_badge" VARCHAR(255),
ADD COLUMN     "level_color" VARCHAR(20),
ADD COLUMN     "max_file_size" SMALLINT NOT NULL DEFAULT 0,
ADD COLUMN     "post_interval" SMALLINT NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "forum_level_rule_is_enabled_order_idx" ON "forum_level_rule"("is_enabled", "order");

-- CreateIndex
CREATE INDEX "forum_level_rule_is_enabled_required_points_idx" ON "forum_level_rule"("is_enabled", "required_points");
