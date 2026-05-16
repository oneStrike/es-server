DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "background_task"
    WHERE "task_type" = 'content.third-party-comic-import'
      AND "status" IN (2, 3)
  ) THEN
    RAISE EXCEPTION 'third_party_import_cutover_blocked_active_tasks';
  END IF;
END $$;

ALTER TABLE "background_task" ADD COLUMN "dedupe_key" varchar(240);
ALTER TABLE "background_task" ADD COLUMN "serial_key" varchar(240);

ALTER TABLE "background_task"
ADD CONSTRAINT "background_task_dedupe_key_nonblank_chk"
CHECK ("dedupe_key" IS NULL OR length(trim("dedupe_key")) > 0);

ALTER TABLE "background_task"
ADD CONSTRAINT "background_task_serial_key_nonblank_chk"
CHECK ("serial_key" IS NULL OR length(trim("serial_key")) > 0);

CREATE TABLE "background_task_conflict_key" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "task_id" varchar(36) NOT NULL,
  "task_type" varchar(120) NOT NULL,
  "conflict_key" varchar(300) NOT NULL,
  "released_at" timestamp(6) with time zone,
  "created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp(6) with time zone NOT NULL,
  CONSTRAINT "background_task_conflict_key_nonblank_chk" CHECK (length(trim("conflict_key")) > 0)
);

WITH cutover AS (
  SELECT clock_timestamp()::timestamptz(6) AS "now"
)
UPDATE "background_task"
SET
  "status" = 6,
  "error" = jsonb_build_object(
    'name', 'BackgroundTaskCutoverCancelledError',
    'message', '破坏性更新取消旧待执行导入任务，请重新提交',
    'cause', jsonb_build_object('code', 'third_party_import_cutover_cancelled')
  ),
  "cancel_requested_at" = (SELECT "now" FROM cutover),
  "finished_at" = (SELECT "now" FROM cutover),
  "updated_at" = (SELECT "now" FROM cutover),
  "claimed_by" = NULL,
  "claim_expires_at" = NULL,
  "rollback_error" = NULL
WHERE "task_type" = 'content.third-party-comic-import'
  AND "status" = 1;

CREATE INDEX "background_task_task_type_dedupe_key_idx"
ON "background_task" USING btree ("task_type", "dedupe_key");

CREATE INDEX "background_task_task_type_serial_key_status_idx"
ON "background_task" USING btree ("task_type", "serial_key", "status");

CREATE UNIQUE INDEX "background_task_task_type_active_dedupe_key_uidx"
ON "background_task" USING btree ("task_type", "dedupe_key")
WHERE "dedupe_key" IS NOT NULL AND "status" IN (1, 2, 3);

CREATE UNIQUE INDEX "background_task_task_type_executing_serial_key_uidx"
ON "background_task" USING btree ("task_type", "serial_key")
WHERE "serial_key" IS NOT NULL AND "status" IN (2, 3);

CREATE UNIQUE INDEX "background_task_conflict_key_task_type_active_key_uidx"
ON "background_task_conflict_key" USING btree ("task_type", "conflict_key")
WHERE "released_at" IS NULL;

CREATE INDEX "background_task_conflict_key_task_id_idx"
ON "background_task_conflict_key" USING btree ("task_id");

CREATE INDEX "background_task_conflict_key_task_type_key_idx"
ON "background_task_conflict_key" USING btree ("task_type", "conflict_key");

CREATE INDEX "background_task_conflict_key_released_created_at_idx"
ON "background_task_conflict_key" USING btree ("released_at", "created_at");
