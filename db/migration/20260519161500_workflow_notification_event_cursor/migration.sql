CREATE INDEX "workflow_event_notification_created_at_id_idx"
  ON "workflow_event" ("created_at", "id")
  WHERE "event_type" in (8, 10);
