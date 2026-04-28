ALTER TABLE "forum_topic"
ALTER COLUMN "body" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_comment"
ALTER COLUMN "body" SET NOT NULL;
