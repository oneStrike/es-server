ALTER TABLE "chat_conversation"
ADD COLUMN "has_messages" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "chat_conversation"
SET "has_messages" = true
WHERE "last_message_id" IS NOT NULL
   OR EXISTS (
    SELECT 1
    FROM "chat_message"
    WHERE "chat_message"."conversation_id" = "chat_conversation"."id"
  );
