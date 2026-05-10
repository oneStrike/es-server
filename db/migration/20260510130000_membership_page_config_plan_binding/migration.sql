CREATE TABLE IF NOT EXISTS "membership_page_config_plan" (
  "page_config_id" integer NOT NULL,
  "plan_id" integer NOT NULL,
  "sort_order" smallint DEFAULT 0 NOT NULL,
  CONSTRAINT "membership_page_config_plan_page_config_id_plan_id_pk"
    PRIMARY KEY ("page_config_id", "plan_id"),
  CONSTRAINT "membership_page_config_plan_sort_order_non_negative_chk"
    CHECK ("sort_order" >= 0)
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "membership_page_config_plan_page_sort_idx"
  ON "membership_page_config_plan" ("page_config_id", "sort_order");

CREATE INDEX IF NOT EXISTS "membership_page_config_plan_plan_id_idx"
  ON "membership_page_config_plan" ("plan_id");

--> statement-breakpoint

INSERT INTO "membership_page_config_plan" (
  "page_config_id",
  "plan_id",
  "sort_order"
)
SELECT
  "page_config"."id",
  "plan"."id",
  (
    row_number() OVER (
      PARTITION BY "page_config"."id"
      ORDER BY "plan"."tier", "plan"."sort_order", "plan"."id"
    ) - 1
  )::smallint
FROM "membership_page_config" "page_config"
INNER JOIN "membership_plan" "plan"
  ON "plan"."is_enabled" = true
ON CONFLICT ("page_config_id", "plan_id") DO NOTHING;
