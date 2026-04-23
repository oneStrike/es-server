-- Hard cutover:
-- 1. `progress_mode` 与 `unique_dimension_key` 正式下线。
-- 2. 事件步骤是否按不同对象累计，仅由模板元数据 + `dedupe_scope` 表达。
ALTER TABLE "task_step"
  DROP CONSTRAINT IF EXISTS "task_step_progress_mode_valid_chk";

ALTER TABLE "task_step"
  DROP CONSTRAINT IF EXISTS "task_step_unique_dimension_key_not_blank_chk";

ALTER TABLE "task_step"
  DROP COLUMN IF EXISTS "progress_mode";

ALTER TABLE "task_step"
  DROP COLUMN IF EXISTS "unique_dimension_key";
