CREATE TABLE "notification_template" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notification_template_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"template_key" varchar(80) NOT NULL CONSTRAINT "notification_template_template_key_key" UNIQUE,
	"notification_type" smallint NOT NULL CONSTRAINT "notification_template_notification_type_key" UNIQUE,
	"title_template" varchar(200) NOT NULL,
	"content_template" varchar(1000) NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"remark" varchar(500),
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "notification_template_notification_type_idx" ON "notification_template" ("notification_type");--> statement-breakpoint
CREATE INDEX "notification_template_is_enabled_idx" ON "notification_template" ("is_enabled");--> statement-breakpoint
CREATE INDEX "notification_template_updated_at_idx" ON "notification_template" ("updated_at");