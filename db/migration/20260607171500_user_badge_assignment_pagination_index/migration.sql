CREATE INDEX IF NOT EXISTS "user_badge_assignment_user_created_badge_idx"
ON "user_badge_assignment" ("user_id", "created_at" DESC, "badge_id");
