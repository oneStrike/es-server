DROP TABLE "forum_config";--> statement-breakpoint
DROP TABLE "forum_config_history";--> statement-breakpoint
ALTER TABLE "work" ADD COLUMN "forum_section_id" integer;--> statement-breakpoint
ALTER TABLE "forum_section" ALTER COLUMN "name" SET DATA TYPE varchar(100) USING "name"::varchar(100);--> statement-breakpoint
ALTER TABLE "work" ADD CONSTRAINT "work_forum_section_id_key" UNIQUE("forum_section_id");--> statement-breakpoint
CREATE INDEX "work_forum_section_id_idx" ON "work" ("forum_section_id");