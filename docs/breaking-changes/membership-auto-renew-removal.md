# Membership Auto-Renew Removal

## Scope

Membership auto-renew signing, agreement storage, provider withhold configuration, and admin auto-renew management are removed from `es-server` and `es-admin`. One-time VIP purchase through `user_membership_subscription` remains supported.

`es-app-v2` is intentionally outside this change and must not be regenerated or edited as part of this rollout.

## Deployment Preconditions

Before applying `db/migration/20260530164242_remove_membership_auto_renew/migration.sql` in any environment, operators must prove both destructive-removal preconditions:

- `membership_auto_renew_agreement` contains zero rows.
- `payment_order` contains zero rows where `subscription_mode in (2, 3)` or `auto_renew_agreement_id is not null`.

The migration raises an exception and stops when either precondition is false. That failure is intentional. Export, cancel, archive, or otherwise resolve historical auto-renew agreements and renewal orders before retrying the migration; do not bypass the guard by editing the migration.

## Contract Notes

- New payment orders accept only one-time subscription mode.
- Missing `subscriptionMode` still defaults to one-time.
- Removed auto-renew APIs, DTO fields, admin tabs, and generated client exports have no compatibility shim.
- Historical migration snapshots may still mention removed columns or tables; active schema, service, controller, and admin business code must not.
