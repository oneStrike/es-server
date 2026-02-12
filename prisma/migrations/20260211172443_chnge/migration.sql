/*
  Warnings:

  - You are about to drop the column `sort_order` on the `user_badge` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "user_badge_sort_order_idx";

-- AlterTable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'sys_dictionary_item'
      AND column_name = 'order'
  ) THEN
    ALTER TABLE "sys_dictionary_item" ALTER COLUMN "order" DROP NOT NULL;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "user_badge" DROP COLUMN "sort_order",
ADD COLUMN     "sortOrder" SMALLINT NOT NULL DEFAULT 0,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user_experience_record" RENAME CONSTRAINT "app_experience_record_pkey" TO "user_experience_record_pkey";

-- AlterTable
ALTER TABLE "user_experience_rule" RENAME CONSTRAINT "app_experience_rule_pkey" TO "user_experience_rule_pkey";

-- AlterTable
ALTER TABLE "user_growth_event" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user_level_rule" RENAME CONSTRAINT "app_level_rule_pkey" TO "user_level_rule_pkey";

-- AlterTable
ALTER TABLE "user_point_record" RENAME CONSTRAINT "app_point_record_pkey" TO "user_point_record_pkey";

-- AlterTable
ALTER TABLE "user_point_rule" RENAME CONSTRAINT "app_point_rule_pkey" TO "user_point_rule_pkey";

-- CreateIndex
CREATE INDEX "user_badge_sortOrder_idx" ON "user_badge"("sortOrder");

-- RenameForeignKey
ALTER TABLE "user_experience_record" RENAME CONSTRAINT "app_experience_record_rule_id_fkey" TO "user_experience_record_rule_id_fkey";

-- RenameForeignKey
ALTER TABLE "user_experience_record" RENAME CONSTRAINT "app_experience_record_user_id_fkey" TO "user_experience_record_user_id_fkey";

-- RenameForeignKey
ALTER TABLE "user_point_record" RENAME CONSTRAINT "app_point_record_rule_id_fkey" TO "user_point_record_rule_id_fkey";

-- RenameForeignKey
ALTER TABLE "user_point_record" RENAME CONSTRAINT "app_point_record_user_id_fkey" TO "user_point_record_user_id_fkey";

-- RenameIndex
ALTER INDEX "app_experience_record_created_at_idx" RENAME TO "user_experience_record_created_at_idx";

-- RenameIndex
ALTER INDEX "app_experience_record_rule_id_idx" RENAME TO "user_experience_record_rule_id_idx";

-- RenameIndex
ALTER INDEX "app_experience_record_user_id_created_at_idx" RENAME TO "user_experience_record_user_id_created_at_idx";

-- RenameIndex
ALTER INDEX "app_experience_record_user_id_idx" RENAME TO "user_experience_record_user_id_idx";

-- RenameIndex
ALTER INDEX "app_experience_rule_created_at_idx" RENAME TO "user_experience_rule_created_at_idx";

-- RenameIndex
ALTER INDEX "app_experience_rule_is_enabled_idx" RENAME TO "user_experience_rule_is_enabled_idx";

-- RenameIndex
ALTER INDEX "app_experience_rule_type_idx" RENAME TO "user_experience_rule_type_idx";

-- RenameIndex
ALTER INDEX "app_experience_rule_type_key" RENAME TO "user_experience_rule_type_key";

-- RenameIndex
ALTER INDEX "app_level_rule_created_at_idx" RENAME TO "user_level_rule_created_at_idx";

-- RenameIndex
ALTER INDEX "app_level_rule_is_enabled_required_experience_idx" RENAME TO "user_level_rule_is_enabled_required_experience_idx";

-- RenameIndex
ALTER INDEX "app_level_rule_is_enabled_sortOrder_idx" RENAME TO "user_level_rule_is_enabled_sortOrder_idx";

-- RenameIndex
ALTER INDEX "app_level_rule_name_key" RENAME TO "user_level_rule_name_key";

-- RenameIndex
ALTER INDEX "app_point_record_created_at_idx" RENAME TO "user_point_record_created_at_idx";

-- RenameIndex
ALTER INDEX "app_point_record_rule_id_idx" RENAME TO "user_point_record_rule_id_idx";

-- RenameIndex
ALTER INDEX "app_point_record_user_id_created_at_idx" RENAME TO "user_point_record_user_id_created_at_idx";

-- RenameIndex
ALTER INDEX "app_point_record_user_id_idx" RENAME TO "user_point_record_user_id_idx";

-- RenameIndex
ALTER INDEX "app_point_rule_created_at_idx" RENAME TO "user_point_rule_created_at_idx";

-- RenameIndex
ALTER INDEX "app_point_rule_is_enabled_idx" RENAME TO "user_point_rule_is_enabled_idx";

-- RenameIndex
ALTER INDEX "app_point_rule_name_key" RENAME TO "user_point_rule_name_key";

-- RenameIndex
ALTER INDEX "app_point_rule_type_idx" RENAME TO "user_point_rule_type_idx";

-- RenameIndex
ALTER INDEX "app_point_rule_type_key" RENAME TO "user_point_rule_type_key";
