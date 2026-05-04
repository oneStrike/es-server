ALTER TABLE "chat_message" DROP CONSTRAINT IF EXISTS "chat_message_message_type_valid_chk";
--> statement-breakpoint
UPDATE "chat_message" SET "message_type" = 99 WHERE "message_type" = 3;
--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_message_type_valid_chk"
CHECK ("message_type" IN (1, 2, 3, 4, 99));
