CREATE INDEX IF NOT EXISTS "sensitive_word_hit_count_desc_idx"
  ON "sensitive_word" ("hit_count" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sensitive_word_last_hit_at_desc_idx"
  ON "sensitive_word" ("last_hit_at" DESC, "id" DESC);
--> statement-breakpoint
DROP INDEX IF EXISTS "sensitive_word_hit_log_sensitive_word_id_created_at_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sensitive_word_hit_log_sensitive_word_id_created_at_idx"
  ON "sensitive_word_hit_log" ("sensitive_word_id", "created_at" DESC, "id" DESC);
--> statement-breakpoint
DROP INDEX IF EXISTS "sensitive_word_hit_log_entity_type_entity_id_created_at_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sensitive_word_hit_log_entity_type_entity_id_created_at_idx"
  ON "sensitive_word_hit_log" ("entity_type", "entity_id", "created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sensitive_word_hit_log_created_at_id_desc_idx"
  ON "sensitive_word_hit_log" ("created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sensitive_word_hit_log_level_created_at_id_idx"
  ON "sensitive_word_hit_log" ("level", "created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sensitive_word_hit_log_type_created_at_id_idx"
  ON "sensitive_word_hit_log" ("type", "created_at" DESC, "id" DESC);
