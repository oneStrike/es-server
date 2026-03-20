ALTER TABLE "app_user" ADD COLUMN "signature" varchar(200);--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "bio" varchar(500);--> statement-breakpoint

CREATE TABLE "app_user_count" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"favorite_count" integer DEFAULT 0 NOT NULL,
	"forum_topic_count" integer DEFAULT 0 NOT NULL,
	"comment_received_like_count" integer DEFAULT 0 NOT NULL,
	"forum_topic_received_like_count" integer DEFAULT 0 NOT NULL,
	"forum_topic_received_favorite_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);--> statement-breakpoint

INSERT INTO "app_user_count" (
	"user_id",
	"comment_count",
	"like_count",
	"favorite_count",
	"forum_topic_count",
	"comment_received_like_count",
	"forum_topic_received_like_count",
	"forum_topic_received_favorite_count",
	"created_at",
	"updated_at"
)
SELECT
	au."id",
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	now(),
	now()
FROM "app_user" AS au;--> statement-breakpoint

DROP TABLE "forum_profile";
