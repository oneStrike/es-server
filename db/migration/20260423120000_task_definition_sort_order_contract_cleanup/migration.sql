-- Hard cutover:
-- 1. `priority` 正式切到 `sort_order`，并统一改为“数值越小越靠前”的新合同。
-- 2. `repeat_timezone` 与 `audience_segment_id` 直接下线，不保留兼容层或历史语义。
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'task_definition'
      AND column_name = 'priority'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'task_definition'
      AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE "task_definition"
      RENAME COLUMN "priority" TO "sort_order";
  END IF;
END $$;

ALTER TABLE "task_definition"
  DROP CONSTRAINT IF EXISTS "task_definition_priority_non_negative_chk";

ALTER TABLE "task_definition"
  DROP CONSTRAINT IF EXISTS "task_definition_repeat_timezone_not_blank_chk";

ALTER TABLE "task_definition"
  DROP CONSTRAINT IF EXISTS "task_definition_audience_segment_id_not_blank_chk";

ALTER TABLE "task_definition"
  DROP COLUMN IF EXISTS "repeat_timezone";

ALTER TABLE "task_definition"
  DROP COLUMN IF EXISTS "audience_segment_id";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'task_definition_sort_order_non_negative_chk'
  ) THEN
    ALTER TABLE "task_definition"
      ADD CONSTRAINT "task_definition_sort_order_non_negative_chk"
      CHECK ("sort_order" >= 0);
  END IF;
END $$;

DROP INDEX IF EXISTS "task_definition_priority_idx";

CREATE INDEX IF NOT EXISTS "task_definition_sort_order_idx"
  ON "task_definition" ("sort_order");
