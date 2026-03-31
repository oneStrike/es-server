ALTER TABLE "growth_ledger_record" ADD COLUMN "source" varchar(40) NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "objective_type" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "event_code" integer;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "objective_config" jsonb;--> statement-breakpoint
ALTER TABLE "task_progress_log" ADD COLUMN "progress_source" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "task_progress_log" ADD COLUMN "event_code" integer;--> statement-breakpoint
ALTER TABLE "task_progress_log" ADD COLUMN "event_biz_key" varchar(180);--> statement-breakpoint
ALTER TABLE "task_progress_log" ADD COLUMN "event_occurred_at" timestamp(6) with time zone;--> statement-breakpoint
ALTER TABLE "task_progress_log" ADD CONSTRAINT "task_progress_log_assignment_id_event_biz_key_key" UNIQUE("assignment_id","event_biz_key");--> statement-breakpoint
CREATE INDEX "task_objective_type_idx" ON "task" ("objective_type");--> statement-breakpoint
CREATE INDEX "task_event_code_idx" ON "task" ("event_code");--> statement-breakpoint
CREATE INDEX "task_progress_log_event_code_created_at_idx" ON "task_progress_log" ("event_code","created_at");