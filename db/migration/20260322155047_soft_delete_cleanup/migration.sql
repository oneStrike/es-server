ALTER TABLE "work_chapter" DROP CONSTRAINT "work_chapter_work_id_sort_order_key";--> statement-breakpoint
ALTER TABLE "sys_dictionary" DROP COLUMN "deleted_at";--> statement-breakpoint
ALTER TABLE "sys_dictionary_item" DROP COLUMN "deleted_at";--> statement-breakpoint
ALTER TABLE "work" RENAME COLUMN "deletedAt" TO "deleted_at";--> statement-breakpoint
CREATE INDEX "app_user_deleted_at_idx" ON "app_user" ("deleted_at");--> statement-breakpoint
CREATE INDEX "work_deleted_at_idx" ON "work" ("deleted_at");--> statement-breakpoint
CREATE INDEX "work_author_deleted_at_idx" ON "work_author" ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "work_chapter_work_id_sort_order_live_idx" ON "work_chapter" ("work_id","sort_order") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "work_chapter_deleted_at_idx" ON "work_chapter" ("deleted_at");
