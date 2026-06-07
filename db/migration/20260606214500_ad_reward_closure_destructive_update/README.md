# Ad Reward Closure Destructive Update

This migration hard-cuts the ad reward database contract to the server/admin closure plan.

It:

- adds immutable `ad_reward_record.target_scope`
- backfills reward scope from `verify_payload.targetScope`, then from the linked `ad_provider_config.target_scope`
- blocks migration if any historical reward record still has no scope
- changes enabled ad provider uniqueness to include `target_scope`
- adds daily-limit, admin-list, and reconcile indexes for reward records
- deletes duplicate AD-source content entitlements, keeping the active row first and then the earliest row
- adds a unique AD entitlement source index on `(grant_source, source_id)` for `grant_source = 3`

## Preflight SQL

Run before applying the migration if release reviewers need impact and stop-risk numbers:

```sql
SELECT count(*) AS enabled_config_without_credential_count
FROM "ad_provider_config"
WHERE "is_enabled" = true
  AND (
    NULLIF("credential_version_ref", '') IS NULL
    OR "config_metadata" IS NULL
    OR jsonb_typeof("config_metadata") <> 'object'
    OR NULLIF("config_metadata"->>'credentialOptionRef', '') IS NULL
    OR NULLIF("config_metadata"->>'verifySecretEnvKey', '') IS NULL
  );

SELECT count(*) AS enabled_unsupported_target_scope_count
FROM "ad_provider_config"
WHERE "is_enabled" = true
  AND "target_scope" <> 1;

SELECT count(*) AS reward_target_scope_backfill_blocker_count
FROM "ad_reward_record" AS "arr"
WHERE NOT (
  "arr"."verify_payload" IS NOT NULL
  AND ("arr"."verify_payload"->>'targetScope') ~ '^[0-9]+$'
  AND ("arr"."verify_payload"->>'targetScope')::smallint IN (1, 2, 3)
)
AND NOT EXISTS (
  SELECT 1
  FROM "ad_provider_config" AS "apc"
  WHERE "apc"."id" = "arr"."ad_provider_config_id"
    AND "apc"."target_scope" IN (1, 2, 3)
);

SELECT count(*) AS duplicate_ad_entitlement_source_count
FROM (
  SELECT "source_id"
  FROM "user_content_entitlement"
  WHERE "grant_source" = 3
    AND "source_id" IS NOT NULL
  GROUP BY "source_id"
  HAVING count(*) > 1
) AS "duplicate_sources";
```

## Release Checklist

1. Run the preflight SQL.
2. Fix or disable enabled configs reported by `enabled_config_without_credential_count`.
3. Fix or disable enabled configs reported by `enabled_unsupported_target_scope_count`; this server cutover only enables low-price chapter ads.
4. Resolve `reward_target_scope_backfill_blocker_count` before migration, because the migration refuses to invent scope for orphaned historical records.
5. Apply the migration.
6. Run `reconcile.sql`.
7. Confirm these stop indicators are `0`:
   - `enabled_config_without_credential_count`
   - `unsupported_target_scope_count`
   - `reward_success_without_entitlement_count`
   - `reward_success_inactive_entitlement_count`
   - `reward_success_expired_active_entitlement_count`
   - `entitlement_without_reward_count`
   - `revoked_reward_active_entitlement_count`
   - `revoked_reward_expired_entitlement_count`
   - `failed_reward_active_entitlement_count`
   - `duplicate_provider_reward_conflict_count`
   - `reward_record_missing_target_scope_count`
   - `ad_entitlement_duplicate_source_count`
   - `missing_ad_provider_config_scope_unique_idx`
   - `missing_ad_reward_daily_limit_idx`
   - `missing_ad_entitlement_source_unique_idx`
8. Record these audit metrics from `reconcile.sql`:
   - `unbackfilled_reward_target_scope_count`
   - `deleted_duplicate_ad_entitlement_count`

`deleted_duplicate_ad_entitlement_count` can be non-zero only if historical data already contained duplicated AD source entitlements. Review the audit count before release sign-off.

## Index Notes

Provider config selection now matches the service contract:

- exact match: `provider, platform, client_app_key, app_id, placement_key, environment, target_scope, is_enabled`
- deterministic ordering support: `sort_order, id`

Reward indexes cover:

- daily limit: `user_id, ad_provider_config_id, status, created_at`
- admin default and filtered lists: status/date/id, target scope/status/date, target/status, user/date, config/date
- exact entitlement revocation and reconcile: unique AD source entitlement index

`reconcile.sql` is intended for operational checks and may scan ad reward and entitlement facts. Run it during release verification and after rollout if reward or download anomalies appear.

## Rollback Limits

Rollback is a version-level rollback of server/admin/database. If rolling back only the DB index contract, first check whether new rows were inserted with the same provider/platform/app/placement/environment across multiple target scopes. Restoring the old enabled unique index would reject those rows.

The duplicate AD entitlement cleanup is destructive. If rollback requires restoring deleted duplicate rows, recover them from database backups using the `deleted_duplicate_ad_entitlement_count` audit count as the expected upper bound.
