ALTER TABLE "sys_config" ADD COLUMN IF NOT EXISTS "wallet_currency_display_config" jsonb;

CREATE INDEX IF NOT EXISTS "growth_ledger_record_wallet_user_asset_created_id_idx"
ON "growth_ledger_record" ("user_id", "asset_type", "asset_key", "created_at" DESC, "id" DESC);
