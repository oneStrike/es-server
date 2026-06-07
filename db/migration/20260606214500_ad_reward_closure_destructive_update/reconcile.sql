WITH "audit_metrics" AS (
  SELECT "metric", "value"
  FROM "migration_audit"
  WHERE "migration_key" = '20260606214500_ad_reward_closure_destructive_update'
)
SELECT
  'unbackfilled_reward_target_scope_count' AS "check_name",
  COALESCE(
    (SELECT "value" FROM "audit_metrics" WHERE "metric" = 'unbackfilled_reward_target_scope_count'),
    0
  ) AS "issue_count"
UNION ALL
SELECT
  'deleted_duplicate_ad_entitlement_count' AS "check_name",
  COALESCE(
    (SELECT "value" FROM "audit_metrics" WHERE "metric" = 'deleted_duplicate_ad_entitlement_count'),
    0
  ) AS "issue_count"
UNION ALL
SELECT
  'enabled_config_without_credential_count' AS "check_name",
  count(*) AS "issue_count"
FROM "ad_provider_config"
WHERE "is_enabled" = true
  AND (
    NULLIF("credential_version_ref", '') IS NULL
    OR "config_metadata" IS NULL
    OR jsonb_typeof("config_metadata") <> 'object'
    OR NULLIF("config_metadata"->>'credentialOptionRef', '') IS NULL
    OR NULLIF("config_metadata"->>'verifySecretEnvKey', '') IS NULL
  )
UNION ALL
SELECT
  'unsupported_target_scope_count' AS "check_name",
  count(*) AS "issue_count"
FROM "ad_provider_config"
WHERE "target_scope" NOT IN (1, 2, 3)
   OR ("is_enabled" = true AND "target_scope" <> 1)
UNION ALL
SELECT
  'reward_success_without_entitlement_count' AS "check_name",
  count(*) AS "issue_count"
FROM "ad_reward_record" AS "arr"
WHERE "arr"."status" = 1
  AND NOT EXISTS (
    SELECT 1
    FROM "user_content_entitlement" AS "uce"
    WHERE "uce"."grant_source" = 3
      AND "uce"."source_id" = "arr"."id"
      AND "uce"."user_id" = "arr"."user_id"
      AND "uce"."target_type" = "arr"."target_type"
      AND "uce"."target_id" = "arr"."target_id"
  )
UNION ALL
SELECT
  'reward_success_inactive_entitlement_count' AS "check_name",
  count(*) AS "issue_count"
FROM "ad_reward_record" AS "arr"
WHERE "arr"."status" = 1
  AND EXISTS (
    SELECT 1
    FROM "user_content_entitlement" AS "uce"
    WHERE "uce"."grant_source" = 3
      AND "uce"."source_id" = "arr"."id"
      AND "uce"."user_id" = "arr"."user_id"
      AND "uce"."target_type" = "arr"."target_type"
      AND "uce"."target_id" = "arr"."target_id"
      AND "uce"."status" <> 1
  )
UNION ALL
SELECT
  'reward_success_expired_active_entitlement_count' AS "check_name",
  count(*) AS "issue_count"
FROM "ad_reward_record" AS "arr"
WHERE "arr"."status" = 1
  AND EXISTS (
    SELECT 1
    FROM "user_content_entitlement" AS "uce"
    WHERE "uce"."grant_source" = 3
      AND "uce"."source_id" = "arr"."id"
      AND "uce"."user_id" = "arr"."user_id"
      AND "uce"."target_type" = "arr"."target_type"
      AND "uce"."target_id" = "arr"."target_id"
      AND "uce"."status" = 1
      AND "uce"."expires_at" IS NOT NULL
      AND "uce"."expires_at" <= now()
  )
UNION ALL
SELECT
  'entitlement_without_reward_count' AS "check_name",
  count(*) AS "issue_count"
FROM "user_content_entitlement" AS "uce"
WHERE "uce"."grant_source" = 3
  AND "uce"."source_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "ad_reward_record" AS "arr"
    WHERE "arr"."id" = "uce"."source_id"
  )
UNION ALL
SELECT
  'revoked_reward_active_entitlement_count' AS "check_name",
  count(*) AS "issue_count"
FROM "ad_reward_record" AS "arr"
WHERE "arr"."status" = 3
  AND EXISTS (
    SELECT 1
    FROM "user_content_entitlement" AS "uce"
    WHERE "uce"."grant_source" = 3
      AND "uce"."source_id" = "arr"."id"
      AND "uce"."user_id" = "arr"."user_id"
      AND "uce"."target_type" = "arr"."target_type"
      AND "uce"."target_id" = "arr"."target_id"
      AND "uce"."status" = 1
      AND ("uce"."expires_at" IS NULL OR "uce"."expires_at" > now())
  )
UNION ALL
SELECT
  'revoked_reward_expired_entitlement_count' AS "check_name",
  count(*) AS "issue_count"
FROM "ad_reward_record" AS "arr"
WHERE "arr"."status" = 3
  AND EXISTS (
    SELECT 1
    FROM "user_content_entitlement" AS "uce"
    WHERE "uce"."grant_source" = 3
      AND "uce"."source_id" = "arr"."id"
      AND "uce"."user_id" = "arr"."user_id"
      AND "uce"."target_type" = "arr"."target_type"
      AND "uce"."target_id" = "arr"."target_id"
      AND "uce"."status" = 1
      AND "uce"."expires_at" IS NOT NULL
      AND "uce"."expires_at" <= now()
  )
UNION ALL
SELECT
  'failed_reward_active_entitlement_count' AS "check_name",
  count(*) AS "issue_count"
FROM "ad_reward_record" AS "arr"
WHERE "arr"."status" = 2
  AND EXISTS (
    SELECT 1
    FROM "user_content_entitlement" AS "uce"
    WHERE "uce"."grant_source" = 3
      AND "uce"."source_id" = "arr"."id"
      AND "uce"."user_id" = "arr"."user_id"
      AND "uce"."target_type" = "arr"."target_type"
      AND "uce"."target_id" = "arr"."target_id"
      AND "uce"."status" = 1
  )
UNION ALL
SELECT
  'duplicate_provider_reward_conflict_count' AS "check_name",
  count(*) AS "issue_count"
FROM (
  SELECT "ad_provider_config_id", "provider_reward_id"
  FROM "ad_reward_record"
  GROUP BY "ad_provider_config_id", "provider_reward_id"
  HAVING count(*) > 1
     AND count(DISTINCT concat_ws(
       ':',
       "user_id"::text,
       "target_scope"::text,
       "target_type"::text,
       "target_id"::text
     )) > 1
) AS "conflicts"
UNION ALL
SELECT
  'reward_record_missing_target_scope_count' AS "check_name",
  count(*) AS "issue_count"
FROM "ad_reward_record"
WHERE "target_scope" IS NULL
   OR "target_scope" NOT IN (1, 2, 3)
UNION ALL
SELECT
  'ad_entitlement_duplicate_source_count' AS "check_name",
  count(*) AS "issue_count"
FROM (
  SELECT "source_id"
  FROM "user_content_entitlement"
  WHERE "grant_source" = 3
    AND "source_id" IS NOT NULL
  GROUP BY "source_id"
  HAVING count(*) > 1
) AS "duplicate_sources"
UNION ALL
SELECT
  'missing_ad_provider_config_scope_unique_idx' AS "check_name",
  CASE WHEN EXISTS (
    SELECT 1
    FROM "pg_indexes"
    WHERE "schemaname" = 'public'
      AND "tablename" = 'ad_provider_config'
      AND "indexname" = 'ad_provider_config_enabled_unique_idx'
      AND "indexdef" LIKE '%target_scope%'
  ) THEN 0 ELSE 1 END AS "issue_count"
UNION ALL
SELECT
  'missing_ad_reward_daily_limit_idx' AS "check_name",
  CASE WHEN EXISTS (
    SELECT 1
    FROM "pg_indexes"
    WHERE "schemaname" = 'public'
      AND "tablename" = 'ad_reward_record'
      AND "indexname" = 'ad_reward_record_user_config_status_created_at_idx'
  ) THEN 0 ELSE 1 END AS "issue_count"
UNION ALL
SELECT
  'missing_ad_entitlement_source_unique_idx' AS "check_name",
  CASE WHEN EXISTS (
    SELECT 1
    FROM "pg_indexes"
    WHERE "schemaname" = 'public'
      AND "tablename" = 'user_content_entitlement'
      AND "indexname" = 'user_content_entitlement_ad_source_unique_idx'
  ) THEN 0 ELSE 1 END AS "issue_count";
