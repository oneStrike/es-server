-- Preflight script for 20260508020000_vip_agreement_app_agreement_breaking.
-- Run before the migration: the old agreement code columns are intentionally
-- removed by the breaking migration after this report is clean.
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
    'membership_page_config'::text AS "legacy_source",
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
    'membership_plan_agreement_codes'::text AS "legacy_source",
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
    "legacy_source",
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
),
"resolved_agreement_codes" AS (
  SELECT
    "mapped".*,
    "agreement"."id" AS "agreement_id"
  FROM "mapped_agreement_codes" "mapped"
  LEFT JOIN "published_agreement" "agreement"
    ON "agreement"."title" = "mapped"."agreement_title"
),
"duplicate_agreement_codes" AS (
  SELECT
    "page_config_id",
    "agreement_id",
    count(*)::int AS "duplicate_count"
  FROM "resolved_agreement_codes"
  WHERE "agreement_id" IS NOT NULL
  GROUP BY "page_config_id", "agreement_id"
  HAVING count(*) > 1
),
"summary" AS (
  SELECT
    count(*)::int AS "old_ref_count",
    count("agreement_id")::int AS "migrated_ref_count",
    count(*) FILTER (WHERE "agreement_id" IS NULL)::int AS "missing_ref_count",
    COALESCE(
      (SELECT sum("duplicate_count" - 1)::int FROM "duplicate_agreement_codes"),
      0
    ) AS "duplicate_ref_count",
    count(*) FILTER (
      WHERE "legacy_source" = 'membership_plan_agreement_codes'
        AND "agreement_id" IS NULL
    )::int AS "unmigrated_plan_agreement_codes"
  FROM "resolved_agreement_codes"
)
SELECT
  'vip_agreement_code_backfill' AS "check_name",
  "summary"."old_ref_count",
  "summary"."migrated_ref_count",
  "summary"."missing_ref_count",
  "summary"."duplicate_ref_count",
  "summary"."unmigrated_plan_agreement_codes",
  CASE
    WHEN "summary"."missing_ref_count" = 0
      AND "summary"."duplicate_ref_count" = 0
      AND "summary"."unmigrated_plan_agreement_codes" = 0
      THEN 'ok'
    ELSE 'stop'
  END AS "status",
  jsonb_build_object(
    'missing',
    (
      SELECT COALESCE(jsonb_agg(to_jsonb("missing")), '[]'::jsonb)
      FROM (
        SELECT
          "legacy_source",
          "page_config_id",
          "agreement_code",
          "agreement_title"
        FROM "resolved_agreement_codes"
        WHERE "agreement_id" IS NULL
        ORDER BY "legacy_source", "page_config_id", "agreement_code"
        LIMIT 20
      ) "missing"
    ),
    'duplicates',
    (
      SELECT COALESCE(jsonb_agg(to_jsonb("duplicate")), '[]'::jsonb)
      FROM (
        SELECT
          "page_config_id",
          "agreement_id",
          "duplicate_count"
        FROM "duplicate_agreement_codes"
        ORDER BY "page_config_id", "agreement_id"
        LIMIT 20
      ) "duplicate"
    )
  ) AS "sample_payload"
FROM "summary";
