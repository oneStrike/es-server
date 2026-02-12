CREATE TABLE IF NOT EXISTS "user_growth_event_archive" (
  "id" SERIAL PRIMARY KEY,
  "source_id" INTEGER NOT NULL,
  "business" VARCHAR(20) NOT NULL,
  "event_key" VARCHAR(50) NOT NULL,
  "user_id" INTEGER NOT NULL,
  "target_id" INTEGER,
  "ip" VARCHAR(45),
  "device_id" VARCHAR(100),
  "occurred_at" TIMESTAMPTZ(6) NOT NULL,
  "status" VARCHAR(30) NOT NULL,
  "rule_refs" JSONB,
  "points_delta_applied" INTEGER NOT NULL DEFAULT 0,
  "experience_delta_applied" INTEGER NOT NULL DEFAULT 0,
  "badge_assigned" JSONB,
  "context" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "archived_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "user_growth_event_archive_source_id_idx"
  ON "user_growth_event_archive" ("source_id");
CREATE INDEX IF NOT EXISTS "user_growth_event_archive_user_id_idx"
  ON "user_growth_event_archive" ("user_id");
CREATE INDEX IF NOT EXISTS "user_growth_event_archive_occurred_at_idx"
  ON "user_growth_event_archive" ("occurred_at");
