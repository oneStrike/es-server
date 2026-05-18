CREATE TABLE "content_import_event_link" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "workflow_event_id" bigint NOT NULL,
  "content_import_job_id" bigint NOT NULL,
  "content_import_item_id" bigint,
  "content_import_item_attempt_id" bigint,
  CONSTRAINT "content_import_event_link_workflow_event_id_key" UNIQUE ("workflow_event_id")
);

CREATE INDEX "content_import_event_link_job_idx" ON "content_import_event_link" ("content_import_job_id");
CREATE INDEX "content_import_event_link_item_idx" ON "content_import_event_link" ("content_import_item_id");
CREATE INDEX "content_import_event_link_item_attempt_idx" ON "content_import_event_link" ("content_import_item_attempt_id");
