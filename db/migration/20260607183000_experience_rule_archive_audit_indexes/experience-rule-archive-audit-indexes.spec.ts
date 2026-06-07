/// <reference types="jest" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migrationDir = resolve(
  'db/migration/20260607183000_experience_rule_archive_audit_indexes',
)

function readMigrationFile(fileName: string) {
  return readFileSync(resolve(migrationDir, fileName), 'utf8')
}

describe('experience rule archive migration contract', () => {
  const migrationSql = readMigrationFile('migration.sql')

  it('replaces historical uniqueness with active-only partial unique', () => {
    expect(migrationSql).toContain(
      'DROP CONSTRAINT IF EXISTS "growth_reward_rule_type_asset_type_asset_key_key"',
    )
    expect(migrationSql).toContain(
      'CREATE UNIQUE INDEX "growth_reward_rule_type_asset_type_asset_key_active_key"',
    )
    expect(migrationSql).toContain('WHERE "archived_at" IS NULL')
  })

  it('archives unconfigurable experience rules with durable reasons', () => {
    expect(migrationSql).toContain(
      '"archived_unconfigurable_experience_rule"',
    )
    expect(migrationSql).toContain("'EVENT_NOT_IMPLEMENTED'")
    expect(migrationSql).toContain("'EVENT_NOT_CONFIGURABLE'")
    expect(migrationSql).toContain(
      "'archived_unconfigurable_experience_rule_count'",
    )
    expect(migrationSql).toContain('"asset_type" = 2')
    expect(migrationSql).toContain('"is_enabled" = false')
  })

  it('adds global audit index for experience ledger pagination', () => {
    expect(migrationSql).toContain(
      'CREATE INDEX IF NOT EXISTS "growth_ledger_record_asset_type_created_id_idx"',
    )
    expect(migrationSql).toContain(
      'ON "growth_ledger_record" ("asset_type", "created_at" DESC, "id" DESC)',
    )
  })
})
