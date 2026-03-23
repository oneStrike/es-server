CREATE TABLE "user_follow" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_follow_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"target_type" smallint NOT NULL,
	"target_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_follow_target_type_target_id_user_id_key" UNIQUE("target_type","target_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "app_user_count" ADD COLUMN "following_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_user_count" ADD COLUMN "followers_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "user_follow_user_id_target_type_created_at_idx" ON "user_follow" ("user_id","target_type","created_at");--> statement-breakpoint
CREATE INDEX "user_follow_target_type_target_id_created_at_idx" ON "user_follow" ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "user_follow_target_type_target_id_idx" ON "user_follow" ("target_type","target_id");