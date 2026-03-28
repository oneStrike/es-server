CREATE TABLE "notification_delivery" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notification_delivery_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"outbox_id" bigint NOT NULL CONSTRAINT "notification_delivery_outbox_id_key" UNIQUE,
	"biz_key" varchar(180) NOT NULL,
	"notification_type" smallint,
	"receiver_user_id" integer,
	"notification_id" integer,
	"status" varchar(32) NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"failure_reason" varchar(500),
	"last_attempt_at" timestamp(6) with time zone NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "notification_delivery_status_updated_at_idx" ON "notification_delivery" ("status","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_delivery_receiver_user_id_updated_at_idx" ON "notification_delivery" ("receiver_user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_delivery_notification_type_status_updated_at_idx" ON "notification_delivery" ("notification_type","status","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_delivery_biz_key_idx" ON "notification_delivery" ("biz_key");