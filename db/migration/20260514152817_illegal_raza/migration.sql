CREATE TABLE "work_comic_archive_import_preview_session" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_comic_archive_import_preview_session_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"task_id" varchar(36) NOT NULL CONSTRAINT "work_comic_archive_import_preview_session_task_id_key" UNIQUE,
	"work_id" integer NOT NULL,
	"chapter_id" integer,
	"status" smallint NOT NULL,
	"expires_at" timestamp(6) with time zone NOT NULL,
	"created_at" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(6) with time zone NOT NULL,
	CONSTRAINT "work_comic_archive_import_preview_session_status_valid_chk" CHECK ("status" in (1, 2))
);
--> statement-breakpoint
CREATE INDEX "work_comic_archive_import_preview_session_work_id_idx" ON "work_comic_archive_import_preview_session" ("work_id");--> statement-breakpoint
CREATE INDEX "work_comic_archive_import_preview_session_status_expires_at_idx" ON "work_comic_archive_import_preview_session" ("status","expires_at");