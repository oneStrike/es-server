ALTER TABLE "work_tag_relation"
  ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL;

DROP INDEX IF EXISTS "work_tag_relation_work_id_sort_order_idx";
CREATE INDEX "work_tag_relation_work_id_sort_order_idx"
  ON "work_tag_relation" ("work_id", "sort_order", "tag_id");

