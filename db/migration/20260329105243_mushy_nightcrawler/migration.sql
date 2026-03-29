ALTER TABLE "app_user_count" ADD COLUMN "following_user_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_user_count" ADD COLUMN "following_author_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_user_count" ADD COLUMN "following_section_count" integer DEFAULT 0 NOT NULL;