CREATE TABLE "notification_preference" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notification_preference_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"notification_type" smallint NOT NULL,
	"is_enabled" boolean NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "notification_preference_user_id_notification_type_key" UNIQUE("user_id","notification_type")
);
--> statement-breakpoint
CREATE INDEX "notification_preference_user_id_idx" ON "notification_preference" ("user_id");--> statement-breakpoint
CREATE INDEX "notification_preference_user_id_is_enabled_idx" ON "notification_preference" ("user_id","is_enabled");