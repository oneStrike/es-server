DROP INDEX "work_author_type_idx";--> statement-breakpoint
CREATE INDEX "work_author_type_idx" ON "work_author" USING gin ("type");--> statement-breakpoint
DROP INDEX "work_category_content_type_idx";--> statement-breakpoint
CREATE INDEX "work_category_content_type_idx" ON "work_category" USING gin ("content_type");