ALTER TABLE "user_work_browse_state" RENAME TO "user_browse_state";

ALTER TABLE "user_browse_state" RENAME COLUMN "work_id" TO "target_id";
ALTER TABLE "user_browse_state" RENAME COLUMN "work_type" TO "target_type";

ALTER TABLE "user_browse_state"
  DROP CONSTRAINT IF EXISTS "user_work_browse_state_work_id_fkey";
ALTER TABLE "user_browse_state"
  DROP CONSTRAINT IF EXISTS "user_browse_state_target_id_fkey";

DROP INDEX IF EXISTS "user_work_browse_state_user_id_work_id_key";
DROP INDEX IF EXISTS "user_work_browse_state_user_id_target_type_target_id_key";
CREATE UNIQUE INDEX "user_browse_state_user_id_target_type_target_id_key"
ON "user_browse_state"("user_id", "target_type", "target_id");

DROP INDEX IF EXISTS "user_work_browse_state_user_id_work_type_last_viewed_at_idx";
DROP INDEX IF EXISTS "user_work_browse_state_user_id_target_type_last_viewed_at_idx";
CREATE INDEX "user_browse_state_user_id_target_type_last_viewed_at_idx"
ON "user_browse_state"("user_id", "target_type", "last_viewed_at");

DROP INDEX IF EXISTS "user_work_browse_state_work_id_idx";
DROP INDEX IF EXISTS "user_work_browse_state_target_id_idx";
CREATE INDEX "user_browse_state_target_id_idx"
ON "user_browse_state"("target_id");

DROP INDEX IF EXISTS "user_work_browse_state_last_viewed_chapter_id_idx";
CREATE INDEX "user_browse_state_last_viewed_chapter_id_idx"
ON "user_browse_state"("last_viewed_chapter_id");
