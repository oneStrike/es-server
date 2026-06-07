# Level Rule Entitlement Closure Breaking

This destructive migration removes level fields that no runtime write path honors and hardens the remaining entitlements.

## Contract

- Drops `login_days`, `blacklist_limit`, and `work_collection_limit`.
- Fails before mutation if any enabled business domain lacks exactly one `required_experience=0` base level.
- Fails before mutation if an enabled business domain has duplicate `required_experience` thresholds.
- Adds deterministic lookup indexes for `business + is_enabled + required_experience desc + id desc`.
- Adds hot-path indexes for daily like/favorite quota counts.

## Preflight

Run `reconcile.sql` before production migration. Empty first and second result sets mean the data is ready for the breaking cutover.

## Rollback Note

The three dropped columns had no runtime enforcement path. Restoring them requires an explicit compatibility migration and admin/API contract rollback.
