/// <reference types="jest" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migrationDir = resolve(
  'db/migration/20260611115900_work_chapter_content_breaking_audit_guard',
)
const destructiveMigrationDir = resolve(
  'db/migration/20260611120000_database_breaking_realtime_repair',
)

function readMigrationFile(fileName: string) {
  return readFileSync(resolve(migrationDir, fileName), 'utf8')
}

describe('work chapter content breaking audit guard migration contract', () => {
  const migrationSql = readMigrationFile('migration.sql')
  const reconcileSql = readMigrationFile('reconcile.sql')
  const readme = readMigrationFile('README.md')
  const destructiveSql = readFileSync(
    resolve(destructiveMigrationDir, 'migration.sql'),
    'utf8',
  )

  it('creates a migration-owned audit table that preserves old content', () => {
    expect(migrationSql).toContain(
      'CREATE TABLE IF NOT EXISTS "work_chapter_content_breaking_audit"',
    )
    expect(migrationSql).toContain('"old_content" text NOT NULL')
    expect(migrationSql).toContain('UNIQUE ("work_chapter_id", "audit_reason")')
    expect(migrationSql).toContain(
      'CHECK ("audit_reason" IN (\'comic_content_not_json_array\'))',
    )
  })

  it('audits and nulls only invalid comic content before the destructive drop', () => {
    expect(migrationSql).toContain(
      'INSERT INTO "work_chapter_content_breaking_audit"',
    )
    expect(migrationSql).toContain('"work_type" = 1')
    expect(migrationSql).toContain(
      '"__work_chapter_content_breaking_is_json_array"("content") = false',
    )
    expect(migrationSql).toContain('SET "content" = NULL')
    expect(migrationSql).toContain(
      'ON CONFLICT ("work_chapter_id", "audit_reason") DO NOTHING',
    )
  })

  it('keeps the following destructive migration strict after the pre-guard', () => {
    expect(destructiveSql).toContain(
      "'work_chapter %.content is not valid comic JSON array'",
    )
    expect(destructiveSql).toContain(
      "'work_chapter %.content is not a comic JSON array'",
    )
    expect(destructiveSql).not.toContain(
      'SET "description" = left(btrim("content"), 1000)',
    )
    expect(destructiveSql).not.toContain('"comic_content_candidate"')
  })

  it('documents and exposes the release reconcile count without runtime dependency', () => {
    expect(reconcileSql).toContain('invalid_comic_content_count')
    expect(reconcileSql).toContain(
      '"__work_chapter_content_breaking_reconcile_is_json_array"("content") = false',
    )
    expect(readme).toContain('code must not read it')
    expect(readme).toContain('invalid_comic_content_count')
  })
})
