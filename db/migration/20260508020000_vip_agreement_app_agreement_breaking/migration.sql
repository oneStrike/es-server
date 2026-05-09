CREATE TABLE IF NOT EXISTS "membership_page_config_agreement" (
  "page_config_id" integer NOT NULL,
  "agreement_id" integer NOT NULL,
  "sort_order" smallint DEFAULT 0 NOT NULL,
  CONSTRAINT "membership_page_config_agreement_page_config_id_agreement_id_pk"
    PRIMARY KEY ("page_config_id", "agreement_id"),
  CONSTRAINT "membership_page_config_agreement_sort_order_non_negative_chk"
    CHECK ("sort_order" >= 0)
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "membership_page_config_agreement_page_sort_idx"
  ON "membership_page_config_agreement" ("page_config_id", "sort_order");

CREATE INDEX IF NOT EXISTS "membership_page_config_agreement_agreement_id_idx"
  ON "membership_page_config_agreement" ("agreement_id");

--> statement-breakpoint

-- 破坏性迁移前置约束：券核销和 VIP 试用订阅的 source 必须唯一，避免幂等重放重复发放权益。
CREATE UNIQUE INDEX IF NOT EXISTS "user_content_entitlement_coupon_source_unique_idx"
  ON "user_content_entitlement" ("grant_source", "source_id")
  WHERE "grant_source" = 2 AND "source_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "user_membership_subscription_vip_trial_coupon_source_key"
  ON "user_membership_subscription" ("source_type", "source_id")
  WHERE "source_type" = 2 AND "source_id" IS NOT NULL;

--> statement-breakpoint

-- membership_page_config.service_agreement_code / privacy_agreement_code / renewal_agreement_code
-- 与 membership_plan_agreement_codes 必须先迁入新关联表，再删除旧列。
WITH "published_agreement" AS (
  SELECT DISTINCT ON ("title")
    "id",
    "title"
  FROM "app_agreement"
  WHERE "is_published" = true
  ORDER BY "title", "published_at" DESC NULLS LAST, "id" DESC
),
"legacy_page_config_agreement_codes" AS (
  SELECT
    "mpc"."id" AS "page_config_id",
    "legacy"."agreement_code",
    "legacy"."sort_order"
  FROM "membership_page_config" "mpc"
  CROSS JOIN LATERAL (
    VALUES
      (NULLIF("mpc"."service_agreement_code", ''), 0),
      (NULLIF("mpc"."privacy_agreement_code", ''), 1),
      (NULLIF("mpc"."renewal_agreement_code", ''), 2)
  ) AS "legacy"("agreement_code", "sort_order")
  WHERE "legacy"."agreement_code" IS NOT NULL
),
"legacy_plan_agreement_codes" AS (
  SELECT
    "mpc"."id" AS "page_config_id",
    COALESCE(
      "plan_code"."value" ->> 'code',
      "plan_code"."value" ->> 'title',
      trim(both '"' from "plan_code"."value"::text)
    ) AS "agreement_code",
    (10 + "plan_code"."ordinality")::smallint AS "sort_order"
  FROM "membership_plan" "mp"
  INNER JOIN "membership_page_config" "mpc"
    ON "mpc"."page_key" = 'vip_subscription'
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof("mp"."agreement_codes") = 'array'
        THEN "mp"."agreement_codes"
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS "plan_code"("value", "ordinality")
  WHERE "mp"."agreement_codes" IS NOT NULL
),
"legacy_agreement_codes" AS (
  SELECT * FROM "legacy_page_config_agreement_codes"
  UNION ALL
  SELECT * FROM "legacy_plan_agreement_codes"
),
"mapped_agreement_codes" AS (
  SELECT
    "page_config_id",
    "agreement_code",
    CASE lower("agreement_code")
      WHEN 'user_agreement' THEN '用户协议'
      WHEN 'privacy_policy' THEN '隐私政策'
      WHEN 'privacy_agreement' THEN '隐私政策'
      WHEN 'service_agreement' THEN '会员服务协议'
      WHEN 'membership_service_agreement' THEN '会员服务协议'
      WHEN 'member_service_agreement' THEN '会员服务协议'
      WHEN 'renewal_agreement' THEN '自动续费协议'
      WHEN 'auto_renew_agreement' THEN '自动续费协议'
      ELSE "agreement_code"
    END AS "agreement_title",
    "sort_order"
  FROM "legacy_agreement_codes"
)
INSERT INTO "membership_page_config_agreement" (
  "page_config_id",
  "agreement_id",
  "sort_order"
)
SELECT DISTINCT ON ("mapped"."page_config_id", "agreement"."id")
  "mapped"."page_config_id",
  "agreement"."id",
  "mapped"."sort_order"
FROM "mapped_agreement_codes" "mapped"
INNER JOIN "published_agreement" "agreement"
  ON "agreement"."title" = "mapped"."agreement_title"
ORDER BY "mapped"."page_config_id", "agreement"."id", "mapped"."sort_order"
ON CONFLICT ("page_config_id", "agreement_id") DO NOTHING;

--> statement-breakpoint

ALTER TABLE "membership_plan"
  DROP COLUMN IF EXISTS "agreement_codes";

ALTER TABLE "membership_page_config"
  DROP COLUMN IF EXISTS "service_agreement_code",
  DROP COLUMN IF EXISTS "privacy_agreement_code",
  DROP COLUMN IF EXISTS "renewal_agreement_code";
