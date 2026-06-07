# Payment Provider Closure Breaking Migration

This migration prepares the database contract for the payment provider closure plan.

It:

- adds immutable provider config version, credential registry, and certificate registry tables
- adds provider notify event and reconciliation record tables
- adds immutable version/credential/certificate references to `payment_order`
- adds payment order indexes for admin order and reconciliation filters
- adds stop-indicator SQL for old app notify URLs, pending orders without immutable versions, mock payloads, enabled configs without credentials, invalid notify URLs, missing H5 return domains, unsupported adapter configs, and index availability

## Release Preconditions

Run `reconcile.sql` in staging/pre-prod before enabling real provider configs.

Every stop indicator must be `0`:

- `old_app_notification_url_count`
- `pending_order_without_version_count`
- `paid_order_with_mock_payload_count`
- `enabled_config_without_credential_count`
- `enabled_config_invalid_notify_url_count`
- `h5_config_without_allowed_domain_count`
- `unsupported_adapter_config_count`
- `missing_payment_order_status_created_idx`
- `missing_payment_order_channel_status_created_idx`
- `missing_payment_order_provider_config_status_created_idx`
- `missing_payment_notify_payload_hash_idx`
- `missing_payment_reconcile_status_created_idx`

`pending_order_without_version_count` must be cleared before release. Do not close, rewrite, or auto-upgrade historical pending orders in the migration to bypass this gate.

## Index Notes

Admin order queries should hit one of these indexes:

- exact order lookup: `payment_order_order_no_key`
- provider trade lookup: `payment_order_provider_trade_no_key`
- default status/date page: `payment_order_status_created_at_id_idx`
- channel/status/date page: `payment_order_channel_status_created_at_idx`
- provider config/status/date page: `payment_order_provider_config_status_created_at_idx`
- user/date page: `payment_order_user_created_at_idx`

Notify and reconciliation queries should hit:

- notify dedupe: `payment_notify_event_payload_hash_key`
- provider event dedupe: `payment_notify_event_provider_event_key`
- notify order lookup: `payment_notify_event_order_idx`
- reconcile default page: `payment_reconciliation_record_status_created_at_idx`
- reconcile mismatch page: `payment_reconciliation_record_mismatch_status_idx`

If production verification requires `EXPLAIN`, attach the output to the release record. At minimum, reviewers must confirm these indexes exist before admin order/reconcile pages are released.

## Rollback Limits

Rollback is a version-level rollback of server/admin/database. Once new provider notifications and immutable config versions are used by production orders, dropping these tables would remove audit evidence. Preserve a database backup before rollback.
