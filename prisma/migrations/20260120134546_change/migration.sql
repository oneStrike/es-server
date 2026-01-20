/*
  Warnings:

  - You are about to drop the column `theme_color` on the `app_config` table. All the data in the column will be lost.
  - You are about to drop the column `theme_colors` on the `app_config` table. All the data in the column will be lost.
  - You are about to alter the column `app_desc` on the `app_config` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(500)`.
  - You are about to alter the column `app_logo` on the `app_config` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(500)`.
  - You are about to alter the column `app_name` on the `app_config` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `onboarding_image` on the `app_config` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(1000)`.
  - Made the column `app_name` on table `app_config` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "app_config" DROP COLUMN "theme_color",
DROP COLUMN "theme_colors",
ADD COLUMN     "enable_maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maintenance_message" VARCHAR(500),
ADD COLUMN     "updated_by_id" INTEGER,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "app_desc" SET DATA TYPE VARCHAR(500),
ALTER COLUMN "app_logo" SET DATA TYPE VARCHAR(500),
ALTER COLUMN "app_name" SET NOT NULL,
ALTER COLUMN "app_name" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "onboarding_image" SET DATA TYPE VARCHAR(1000);

-- CreateIndex
CREATE INDEX "app_config_updated_by_id_idx" ON "app_config"("updated_by_id");
