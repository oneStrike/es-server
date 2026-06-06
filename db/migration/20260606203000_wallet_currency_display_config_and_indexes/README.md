# Wallet currency display config and ledger index

Adds `sys_config.wallet_currency_display_config` for virtual-currency display metadata and a wallet ledger query index matching:

- `user_id`
- `asset_type`
- `asset_key`
- `created_at DESC`
- `id DESC`

This migration is intentionally independent from the existing forum topic migration.
