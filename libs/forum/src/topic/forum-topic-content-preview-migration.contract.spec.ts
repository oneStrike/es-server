import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

describe('forum topic content preview migration contract', () => {
  it('keeps contentPreview as a materialized non-null list read model', () => {
    const repoRoot = path.resolve(__dirname, '../../../../')
    const migrationPath = path.join(
      repoRoot,
      'db/migration/20260501151000_forum_topic_content_preview_hard_cutover/migration.sql',
    )
    const commentsPath = path.join(repoRoot, 'db/comments/generated.sql')

    expect(existsSync(migrationPath)).toBe(true)

    const migrationSql = readFileSync(migrationPath, 'utf8')
    const commentsSql = readFileSync(commentsPath, 'utf8')

    expect(migrationSql).toContain('ADD COLUMN "content_preview" jsonb;')
    expect(migrationSql).toContain('__forum_topic_build_content_preview')
    expect(migrationSql).toContain(
      "jsonb_build_object('type', 'text', 'text', E'\\n\\n')",
    )
    expect(migrationSql).toContain('UPDATE "forum_topic" AS topic')
    expect(migrationSql).toContain(
      'ALTER COLUMN "content_preview" SET NOT NULL',
    )
    expect(migrationSql).toContain(
      'DROP FUNCTION IF EXISTS "__forum_topic_build_content_preview"(jsonb, text);',
    )
    expect(commentsSql).toContain(
      'COMMENT ON COLUMN "public"."forum_topic"."content_preview"',
    )
  })
})
