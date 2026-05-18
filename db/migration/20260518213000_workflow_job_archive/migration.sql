ALTER TABLE "workflow_job"
  ADD COLUMN "archived_at" timestamp(6) with time zone;

CREATE INDEX "workflow_job_archived_updated_at_id_idx"
  ON "workflow_job" ("archived_at", "updated_at" DESC, "id" DESC);
