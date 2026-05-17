ALTER TABLE "background_task" ADD COLUMN "display_name" varchar(180);

ALTER TABLE "background_task"
ADD CONSTRAINT "background_task_display_name_nonblank_chk"
CHECK ("display_name" IS NULL OR length(trim("display_name")) > 0);
