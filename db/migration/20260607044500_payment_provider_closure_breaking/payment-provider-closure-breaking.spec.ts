/// <reference types="jest" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migrationDir = resolve(
  'db/migration/20260607044500_payment_provider_closure_breaking',
)

function readMigrationFile(fileName: string) {
  return readFileSync(resolve(migrationDir, fileName), 'utf8')
}

describe('payment provider closure migration contract', () => {
  const migrationSql = readMigrationFile('migration.sql')
  const reconcileSql = readMigrationFile('reconcile.sql')
  const readme = readMigrationFile('README.md')

  const stopIndicatorNames = [
    'old_app_notification_url_count',
    'pending_order_without_version_count',
    'paid_order_with_mock_payload_count',
    'enabled_config_without_credential_count',
    'enabled_config_invalid_notify_url_count',
    'h5_config_without_allowed_domain_count',
    'unsupported_adapter_config_count',
    'missing_payment_order_status_created_idx',
    'missing_payment_order_channel_status_created_idx',
    'missing_payment_order_provider_config_status_created_idx',
    'missing_payment_notify_payload_hash_idx',
    'missing_payment_reconcile_status_created_idx',
  ]

  const requiredIndexNames = [
    'payment_order_status_created_at_id_idx',
    'payment_order_channel_status_created_at_idx',
    'payment_order_provider_config_status_created_at_idx',
    'payment_order_user_created_at_idx',
    'payment_notify_event_provider_event_key',
    'payment_notify_event_payload_hash_key',
    'payment_reconciliation_record_status_created_at_idx',
    'payment_reconciliation_record_mismatch_status_idx',
  ]

  it('keeps release-blocking stop indicators in reconcile SQL and README', () => {
    expect(reconcileSql).toContain('UNION ALL')

    stopIndicatorNames.forEach((indicatorName) => {
      expect(reconcileSql).toContain(`'${indicatorName}'`)
      expect(readme).toContain(`\`${indicatorName}\``)
    })

    expect(readme).toContain('Every stop indicator must be `0`')
    expect(readme).toContain('pending_order_without_version_count')
    expect(readme).toContain('Do not close, rewrite, or auto-upgrade')
  })

  it('creates and checks the admin order/reconcile indexes used by release gates', () => {
    requiredIndexNames.forEach((indexName) => {
      expect(migrationSql).toContain(`"${indexName}"`)
    })

    expect(reconcileSql).toContain('payment_order_status_created_at_id_idx')
    expect(reconcileSql).toContain(
      'payment_order_channel_status_created_at_idx',
    )
    expect(reconcileSql).toContain(
      'payment_order_provider_config_status_created_at_idx',
    )
    expect(reconcileSql).toContain('payment_notify_event_payload_hash_key')
    expect(reconcileSql).toContain(
      'payment_reconciliation_record_status_created_at_idx',
    )

    expect(readme).toContain('payment_order_order_no_key')
    expect(readme).toContain('payment_order_provider_trade_no_key')
    expect(readme).toContain(
      'payment_reconciliation_record_mismatch_status_idx',
    )
  })

  it('models notify and reconciliation records without adding writable refund tables', () => {
    expect(migrationSql).toContain(
      'CREATE TABLE IF NOT EXISTS "payment_notify_event"',
    )
    expect(migrationSql).toContain(
      'CREATE TABLE IF NOT EXISTS "payment_reconciliation_record"',
    )
    expect(migrationSql).not.toContain('payment_refund_order')

    expect(reconcileSql).toContain('paid_order_with_mock_payload_count')
    expect(reconcileSql).toContain('%PROVIDER_SIGN_REQUIRED%')
    expect(reconcileSql).toContain('%HMAC_SHA256%')
    expect(readme).toContain('missing_payment_reconcile_status_created_idx')
  })
})
