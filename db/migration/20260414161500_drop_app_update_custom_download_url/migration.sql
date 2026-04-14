UPDATE "app_update_release"
SET "package_url" = "custom_download_url"
WHERE "package_url" IS NULL
  AND "custom_download_url" IS NOT NULL;

ALTER TABLE "app_update_release" DROP COLUMN "custom_download_url";
