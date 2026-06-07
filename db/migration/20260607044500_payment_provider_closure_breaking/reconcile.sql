SELECT
  'old_app_notification_url_count' AS "check_name",
  count(*) AS "issue_count"
FROM "payment_provider_config"
WHERE COALESCE("notify_url", '') LIKE '%app/payment/notification/create%'
UNION ALL
SELECT
  'pending_order_without_version_count' AS "check_name",
  count(*) AS "issue_count"
FROM "payment_order"
WHERE "status" = 1
  AND (
    "provider_config_version_id" IS NULL
    OR "provider_config_version" IS NULL
    OR NULLIF("credential_version_ref", '') IS NULL
  )
UNION ALL
SELECT
  'paid_order_with_mock_payload_count' AS "check_name",
  count(*) AS "issue_count"
FROM "payment_order"
WHERE "status" = 2
  AND (
    COALESCE("client_pay_payload"::text, '') LIKE '%PROVIDER_SIGN_REQUIRED%'
    OR COALESCE("client_pay_payload"::text, '') LIKE '%prepay_id=%'
    OR COALESCE("notify_payload"::text, '') LIKE '%HMAC_SHA256%'
  )
UNION ALL
SELECT
  'enabled_config_without_credential_count' AS "check_name",
  count(*) AS "issue_count"
FROM "payment_provider_config"
WHERE "is_enabled" = true
  AND (
    NULLIF("credential_version_ref", '') IS NULL
    OR (
      "channel" = 1
      AND (
        NULLIF("private_key_ref", '') IS NULL
        OR NULLIF("public_key_ref", '') IS NULL
      )
    )
    OR (
      "channel" = 2
      AND NULLIF("api_v3_key_ref", '') IS NULL
    )
  )
UNION ALL
SELECT
  'enabled_config_invalid_notify_url_count' AS "check_name",
  count(*) AS "issue_count"
FROM "payment_provider_config"
WHERE "is_enabled" = true
  AND (
    NULLIF("notify_url", '') IS NULL
    OR COALESCE("notify_url", '') LIKE '%app/payment/notification/create%'
    OR COALESCE("notify_url", '') NOT LIKE '%app/payment/provider/%/notify%'
  )
UNION ALL
SELECT
  'h5_config_without_allowed_domain_count' AS "check_name",
  count(*) AS "issue_count"
FROM "payment_provider_config"
WHERE "is_enabled" = true
  AND "payment_scene" = 2
  AND (
    "allowed_return_domains" IS NULL
    OR jsonb_typeof("allowed_return_domains") <> 'array'
    OR jsonb_array_length("allowed_return_domains") = 0
  )
UNION ALL
SELECT
  'unsupported_adapter_config_count' AS "check_name",
  count(*) AS "issue_count"
FROM "payment_provider_config"
WHERE "is_enabled" = true
  AND (
    "channel" NOT IN (1, 2)
    OR "payment_scene" NOT IN (1, 2, 3)
    OR "platform" NOT IN (1, 2, 3, 4, 5)
    OR "environment" NOT IN (1, 2)
  )
UNION ALL
SELECT
  'missing_payment_order_status_created_idx' AS "check_name",
  CASE WHEN EXISTS (
    SELECT 1
    FROM "pg_indexes"
    WHERE "schemaname" = 'public'
      AND "tablename" = 'payment_order'
      AND "indexname" = 'payment_order_status_created_at_id_idx'
  ) THEN 0 ELSE 1 END AS "issue_count"
UNION ALL
SELECT
  'missing_payment_order_channel_status_created_idx' AS "check_name",
  CASE WHEN EXISTS (
    SELECT 1
    FROM "pg_indexes"
    WHERE "schemaname" = 'public'
      AND "tablename" = 'payment_order'
      AND "indexname" = 'payment_order_channel_status_created_at_idx'
  ) THEN 0 ELSE 1 END AS "issue_count"
UNION ALL
SELECT
  'missing_payment_order_provider_config_status_created_idx' AS "check_name",
  CASE WHEN EXISTS (
    SELECT 1
    FROM "pg_indexes"
    WHERE "schemaname" = 'public'
      AND "tablename" = 'payment_order'
      AND "indexname" = 'payment_order_provider_config_status_created_at_idx'
  ) THEN 0 ELSE 1 END AS "issue_count"
UNION ALL
SELECT
  'missing_payment_notify_payload_hash_idx' AS "check_name",
  CASE WHEN EXISTS (
    SELECT 1
    FROM "pg_indexes"
    WHERE "schemaname" = 'public'
      AND "tablename" = 'payment_notify_event'
      AND "indexname" = 'payment_notify_event_payload_hash_key'
  ) THEN 0 ELSE 1 END AS "issue_count"
UNION ALL
SELECT
  'missing_payment_reconcile_status_created_idx' AS "check_name",
  CASE WHEN EXISTS (
    SELECT 1
    FROM "pg_indexes"
    WHERE "schemaname" = 'public'
      AND "tablename" = 'payment_reconciliation_record'
      AND "indexname" = 'payment_reconciliation_record_status_created_at_idx'
  ) THEN 0 ELSE 1 END AS "issue_count";
