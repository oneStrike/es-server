CREATE TABLE "work_comic_archive_import_task" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_comic_archive_import_task_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"task_id" varchar(36) NOT NULL CONSTRAINT "work_comic_archive_import_task_task_id_key" UNIQUE,
	"work_id" integer NOT NULL,
	"mode" varchar(32) NOT NULL,
	"status" varchar(32) NOT NULL,
	"archive_name" varchar(255) NOT NULL,
	"archive_path" varchar(1000) NOT NULL,
	"extract_path" varchar(1000) NOT NULL,
	"require_confirm" boolean DEFAULT true NOT NULL,
	"summary" jsonb NOT NULL,
	"matched_items" jsonb NOT NULL,
	"ignored_items" jsonb NOT NULL,
	"result_items" jsonb NOT NULL,
	"confirmed_chapter_ids" jsonb NOT NULL,
	"started_at" timestamp(6) with time zone,
	"finished_at" timestamp(6) with time zone,
	"expires_at" timestamp(6) with time zone NOT NULL,
	"last_error" text,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "work_comic_archive_import_task_work_id_idx" ON "work_comic_archive_import_task" ("work_id");--> statement-breakpoint
CREATE INDEX "work_comic_archive_import_task_status_idx" ON "work_comic_archive_import_task" ("status");--> statement-breakpoint
CREATE INDEX "work_comic_archive_import_task_status_expires_at_idx" ON "work_comic_archive_import_task" ("status","expires_at");--> statement-breakpoint
CREATE INDEX "work_comic_archive_import_task_expires_at_idx" ON "work_comic_archive_import_task" ("expires_at");--> statement-breakpoint
CREATE INDEX "work_comic_archive_import_task_created_at_idx" ON "work_comic_archive_import_task" ("created_at");