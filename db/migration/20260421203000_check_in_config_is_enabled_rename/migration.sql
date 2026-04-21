ALTER TABLE "check_in_config"
  RENAME COLUMN "enabled" TO "is_enabled";

ALTER INDEX "check_in_config_enabled_idx"
  RENAME TO "check_in_config_is_enabled_idx";

ALTER TABLE "check_in_config"
  RENAME CONSTRAINT "check_in_config_enabled_valid_chk"
  TO "check_in_config_is_enabled_valid_chk";
