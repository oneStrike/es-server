ALTER TABLE "app_user" ADD COLUMN "signature" varchar(200);--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "bio" varchar(500);--> statement-breakpoint

CREATE TABLE "app_user_count" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"forum_topic_count" integer DEFAULT 0 NOT NULL,
	"forum_reply_count" integer DEFAULT 0 NOT NULL,
	"forum_received_like_count" integer DEFAULT 0 NOT NULL,
	"forum_received_favorite_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);--> statement-breakpoint

UPDATE "app_user" AS au
SET
	"signature" = COALESCE(fp."signature", ''),
	"bio" = COALESCE(fp."bio", '')
FROM "forum_profile" AS fp
WHERE fp."user_id" = au."id";--> statement-breakpoint

UPDATE "app_user"
SET "signature" = ''
WHERE "signature" IS NULL;--> statement-breakpoint

UPDATE "app_user"
SET "bio" = ''
WHERE "bio" IS NULL;--> statement-breakpoint

INSERT INTO "app_user_count" (
	"user_id",
	"forum_topic_count",
	"forum_reply_count",
	"forum_received_like_count",
	"forum_received_favorite_count",
	"created_at",
	"updated_at"
)
SELECT
	fp."user_id",
	fp."topic_count",
	fp."reply_count",
	fp."like_count",
	fp."favorite_count",
	COALESCE(fp."created_at", now()),
	COALESCE(fp."updated_at", now())
FROM "forum_profile" AS fp
ON CONFLICT ("user_id") DO NOTHING;--> statement-breakpoint

INSERT INTO "app_user_count" (
	"user_id",
	"forum_topic_count",
	"forum_reply_count",
	"forum_received_like_count",
	"forum_received_favorite_count",
	"created_at",
	"updated_at"
)
SELECT
	au."id",
	0,
	0,
	0,
	0,
	now(),
	now()
FROM "app_user" AS au
LEFT JOIN "app_user_count" AS auc ON auc."user_id" = au."id"
WHERE auc."user_id" IS NULL;--> statement-breakpoint

CREATE INDEX "app_user_count_forum_topic_count_idx" ON "app_user_count" ("forum_topic_count");--> statement-breakpoint
CREATE INDEX "app_user_count_forum_reply_count_idx" ON "app_user_count" ("forum_reply_count");--> statement-breakpoint
CREATE INDEX "app_user_count_forum_received_like_count_idx" ON "app_user_count" ("forum_received_like_count");--> statement-breakpoint
CREATE INDEX "app_user_count_forum_received_favorite_count_idx" ON "app_user_count" ("forum_received_favorite_count");--> statement-breakpoint
CREATE INDEX "app_user_count_created_at_idx" ON "app_user_count" ("created_at");--> statement-breakpoint

DROP TABLE "forum_profile";
