ALTER TABLE "background_task" ADD COLUMN "operator_type" smallint;
ALTER TABLE "background_task" ADD COLUMN "operator_user_id" integer;

UPDATE "background_task"
SET
  "operator_type" = 2,
  "operator_user_id" = NULL
WHERE "operator_type" IS NULL;

ALTER TABLE "background_task" ALTER COLUMN "operator_type" SET NOT NULL;

ALTER TABLE "background_task"
ADD CONSTRAINT "background_task_operator_type_valid_chk"
CHECK ("operator_type" in (1, 2));

ALTER TABLE "background_task"
ADD CONSTRAINT "background_task_operator_user_id_scope_chk"
CHECK (
  ("operator_type" = 1 AND "operator_user_id" IS NOT NULL)
  OR ("operator_type" = 2 AND "operator_user_id" IS NULL)
);

CREATE INDEX "background_task_operator_updated_at_id_idx"
ON "background_task" USING btree (
  "operator_type",
  "operator_user_id",
  "updated_at" DESC,
  "id" DESC
);
