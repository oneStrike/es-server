ALTER TABLE "forum_topic" ALTER COLUMN "videos" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "forum_topic"
ALTER COLUMN "videos" TYPE jsonb
USING COALESCE(to_jsonb("videos"), '[]'::jsonb);
--> statement-breakpoint
ALTER TABLE "forum_topic" ALTER COLUMN "videos" SET DEFAULT '[]'::jsonb;
