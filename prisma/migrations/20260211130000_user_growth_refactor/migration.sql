-- Rename growth tables from app_* to user_*
ALTER TABLE IF EXISTS "app_point_rule" RENAME TO "user_point_rule";
ALTER TABLE IF EXISTS "app_point_record" RENAME TO "user_point_record";
ALTER TABLE IF EXISTS "app_experience_rule" RENAME TO "user_experience_rule";
ALTER TABLE IF EXISTS "app_experience_record" RENAME TO "user_experience_record";
ALTER TABLE IF EXISTS "app_level_rule" RENAME TO "user_level_rule";

ALTER SEQUENCE IF EXISTS "app_point_rule_id_seq" RENAME TO "user_point_rule_id_seq";
ALTER SEQUENCE IF EXISTS "app_point_record_id_seq" RENAME TO "user_point_record_id_seq";
ALTER SEQUENCE IF EXISTS "app_experience_rule_id_seq" RENAME TO "user_experience_rule_id_seq";
ALTER SEQUENCE IF EXISTS "app_experience_record_id_seq" RENAME TO "user_experience_record_id_seq";
ALTER SEQUENCE IF EXISTS "app_level_rule_id_seq" RENAME TO "user_level_rule_id_seq";

-- Extend rule tables with growth fields
ALTER TABLE IF EXISTS "user_point_rule"
  ADD COLUMN IF NOT EXISTS "business" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "event_key" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "cooldown_seconds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total_limit" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS "user_experience_rule"
  ADD COLUMN IF NOT EXISTS "business" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "event_key" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "cooldown_seconds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total_limit" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS "user_level_rule"
  ADD COLUMN IF NOT EXISTS "business" VARCHAR(20);

-- Extend record tables with growth event fields
ALTER TABLE IF EXISTS "user_point_record"
  ADD COLUMN IF NOT EXISTS "event_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "event_key" VARCHAR(50);

ALTER TABLE IF EXISTS "user_experience_record"
  ADD COLUMN IF NOT EXISTS "event_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "event_key" VARCHAR(50);

-- Create user_badge table
CREATE TABLE IF NOT EXISTS "user_badge" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(20) NOT NULL,
  "type" SMALLINT NOT NULL,
  "description" VARCHAR(200),
  "icon" VARCHAR(255),
  "sort_order" SMALLINT NOT NULL DEFAULT 0,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "user_badge_type_idx" ON "user_badge" ("type");
CREATE INDEX IF NOT EXISTS "user_badge_sort_order_idx" ON "user_badge" ("sort_order");
CREATE INDEX IF NOT EXISTS "user_badge_is_enabled_idx" ON "user_badge" ("is_enabled");
CREATE INDEX IF NOT EXISTS "user_badge_created_at_idx" ON "user_badge" ("created_at");

-- Create user_badge_assignment table
CREATE TABLE IF NOT EXISTS "user_badge_assignment" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "badge_id" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "user_badge_assignment_user_id_badge_id_key" UNIQUE ("user_id", "badge_id")
);

CREATE INDEX IF NOT EXISTS "user_badge_assignment_user_id_idx" ON "user_badge_assignment" ("user_id");
CREATE INDEX IF NOT EXISTS "user_badge_assignment_badge_id_idx" ON "user_badge_assignment" ("badge_id");
CREATE INDEX IF NOT EXISTS "user_badge_assignment_created_at_idx" ON "user_badge_assignment" ("created_at");

ALTER TABLE IF EXISTS "user_badge_assignment"
  ADD CONSTRAINT "user_badge_assignment_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE IF EXISTS "user_badge_assignment"
  ADD CONSTRAINT "user_badge_assignment_badge_id_fkey"
  FOREIGN KEY ("badge_id") REFERENCES "user_badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create user_growth_event table
CREATE TABLE IF NOT EXISTS "user_growth_event" (
  "id" SERIAL PRIMARY KEY,
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
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "user_growth_event_business_event_key_idx"
  ON "user_growth_event" ("business", "event_key");
CREATE INDEX IF NOT EXISTS "user_growth_event_user_id_idx" ON "user_growth_event" ("user_id");
CREATE INDEX IF NOT EXISTS "user_growth_event_occurred_at_idx" ON "user_growth_event" ("occurred_at");

ALTER TABLE IF EXISTS "user_growth_event"
  ADD CONSTRAINT "user_growth_event_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add FK references from records to user_growth_event
ALTER TABLE IF EXISTS "user_point_record"
  ADD CONSTRAINT "user_point_record_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "user_growth_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE IF EXISTS "user_experience_record"
  ADD CONSTRAINT "user_experience_record_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "user_growth_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "user_point_record_event_id_idx" ON "user_point_record" ("event_id");
CREATE INDEX IF NOT EXISTS "user_experience_record_event_id_idx" ON "user_experience_record" ("event_id");

-- Drop old forum badge tables
DROP TABLE IF EXISTS "forum_profile_badge" CASCADE;
DROP TABLE IF EXISTS "forum_badge" CASCADE;
