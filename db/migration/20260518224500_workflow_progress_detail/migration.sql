ALTER TABLE "workflow_job"
  ADD COLUMN "progress_detail" jsonb;

COMMENT ON COLUMN "workflow_job"."progress_detail" IS '结构化进度详情快照；用于展示当前运行中的子进度。';
