import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

describe('body historical data migration contract', () => {
  it('keeps the historical body rewrite in database migrations and removes backfill scripts', () => {
    const repoRoot = path.resolve(__dirname, '../../../../')
    const packageJson = JSON.parse(
      readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
    ) as {
      scripts?: Record<string, string>
    }
    const expandMigrationPath = path.join(
      repoRoot,
      'db/migration/20260427143000_topic_comment_body_doc_expand/migration.sql',
    )
    const contractMigrationPath = path.join(
      repoRoot,
      'db/migration/20260427153000_topic_comment_body_doc_contract/migration.sql',
    )
    const backfillMigrationPath = path.join(
      repoRoot,
      'db/migration/20260427154000_topic_comment_body_doc_backfill/migration.sql',
    )
    const expandSql = readFileSync(expandMigrationPath, 'utf8')
    const contractSql = readFileSync(contractMigrationPath, 'utf8')
    const backfillSql = readFileSync(backfillMigrationPath, 'utf8')

    expect(existsSync(expandMigrationPath)).toBe(true)
    expect(existsSync(contractMigrationPath)).toBe(true)
    expect(existsSync(backfillMigrationPath)).toBe(true)
    expect(expandSql).toContain('ALTER TABLE "forum_topic"')
    expect(expandSql).toContain('ADD COLUMN "body" jsonb;')
    expect(expandSql).toContain(
      'ADD COLUMN "body_version" smallint DEFAULT 1 NOT NULL;',
    )
    expect(expandSql).toContain(
      'ADD CONSTRAINT "forum_topic_body_version_valid_chk"',
    )
    expect(expandSql).toContain('ALTER TABLE "user_comment"')
    expect(expandSql).toContain(
      'ADD CONSTRAINT "user_comment_body_version_valid_chk"',
    )
    expect(contractSql).toContain('ALTER TABLE "forum_topic"')
    expect(contractSql).toContain('ALTER COLUMN "body" SET NOT NULL;')
    expect(contractSql).toContain('ALTER TABLE "user_comment"')
    expect(contractSql).toContain('ALTER COLUMN "body" SET NOT NULL;')
    expect(backfillSql).toContain('UPDATE "forum_topic" AS topic')
    expect(backfillSql).toContain('UPDATE "user_comment" AS comment_row')
    expect(backfillSql).toContain('__body_create_doc_from_segments')
    expect(backfillSql).toContain('__body_extract_plain_text_from_legacy_content')
    expect(packageJson.scripts).not.toHaveProperty('db:backfill:forum-topic-body')
    expect(packageJson.scripts).not.toHaveProperty('db:backfill:user-comment-body')
  })
})
