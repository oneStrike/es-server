-- Extend user_badge with business/event_key for rule matching
ALTER TABLE IF EXISTS "user_badge"
  ADD COLUMN IF NOT EXISTS "business" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "event_key" VARCHAR(50);

CREATE INDEX IF NOT EXISTS "user_badge_business_event_key_idx"
  ON "user_badge" ("business", "event_key");
