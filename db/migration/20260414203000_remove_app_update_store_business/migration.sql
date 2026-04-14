BEGIN;

ALTER TABLE "app_update_release"
  DROP COLUMN IF EXISTS "store_links";

DELETE FROM "sys_dictionary_item"
WHERE "dictionary_code" = 'app_update_channel';

DELETE FROM "sys_dictionary"
WHERE "code" = 'app_update_channel';

COMMIT;
