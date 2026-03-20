ALTER TABLE "user_purchase_record"
DROP CONSTRAINT IF EXISTS "user_purchase_record_target_type_target_id_user_id_status_key";--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "user_purchase_record_success_unique_idx"
ON "user_purchase_record" ("target_type", "target_id", "user_id")
WHERE "status" = 1;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "chat_conversation_last_message_id_idx"
ON "chat_conversation" ("last_message_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "chat_conversation_member_last_read_message_id_idx"
ON "chat_conversation_member" ("last_read_message_id");--> statement-breakpoint
