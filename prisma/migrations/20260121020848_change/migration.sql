-- AlterTable
ALTER TABLE "app_config" ADD COLUMN     "optional_theme_colors" VARCHAR(500),
ADD COLUMN     "secondary_color" VARCHAR(20),
ADD COLUMN     "theme_color" VARCHAR(20) NOT NULL DEFAULT '#007AFF';
