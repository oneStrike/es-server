ALTER TABLE "app_update_release" DROP CONSTRAINT "app_update_release_package_source_type_valid_chk";
ALTER TABLE "app_update_release" ADD CONSTRAINT "app_update_release_package_source_type_valid_chk" CHECK ("package_source_type" is null or "package_source_type" in (1, 2, 3));
