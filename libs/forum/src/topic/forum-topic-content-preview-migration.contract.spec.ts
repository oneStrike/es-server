import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

describe('forum topic content preview migration contract', () => {
  it('keeps contentPreview as a materialized non-null list read model', () => {
    const repoRoot = path.resolve(__dirname, '../../../../')
    const hardCutoverMigrationPath = path.join(
      repoRoot,
      'db/migration/20260501151000_forum_topic_content_preview_hard_cutover/migration.sql',
    )
    const emojiFollowupMigrationPath = path.join(
      repoRoot,
      'db/migration/20260501174500_forum_topic_content_preview_emoji_semantic_followup/migration.sql',
    )
    const commentsPath = path.join(repoRoot, 'db/comments/generated.sql')

    expect(existsSync(hardCutoverMigrationPath)).toBe(true)
    expect(existsSync(emojiFollowupMigrationPath)).toBe(true)

    const hardCutoverMigrationSql = readFileSync(
      hardCutoverMigrationPath,
      'utf8',
    )
    const emojiFollowupMigrationSql = readFileSync(
      emojiFollowupMigrationPath,
      'utf8',
    )
    const commentsSql = readFileSync(commentsPath, 'utf8')

    expect(hardCutoverMigrationSql).toContain(
      'ADD COLUMN "content_preview" jsonb;',
    )
    expect(hardCutoverMigrationSql).toContain(
      '__forum_topic_build_content_preview',
    )
    expect(hardCutoverMigrationSql).toContain(
      "jsonb_build_object('type', 'text', 'text', E'\\n\\n')",
    )
    expect(hardCutoverMigrationSql).toContain('UPDATE "forum_topic" AS topic')
    expect(hardCutoverMigrationSql).toContain(
      'ALTER COLUMN "content_preview" SET NOT NULL',
    )
    expect(hardCutoverMigrationSql).toContain(
      'DROP FUNCTION IF EXISTS "__forum_topic_build_content_preview"(jsonb, text);',
    )
    expect(hardCutoverMigrationSql).toContain(
      "RETURN jsonb_build_object('type', 'text', 'text', node_text);",
    )

    expect(emojiFollowupMigrationSql).toContain("WHEN 'emojiUnicode' THEN")
    expect(emojiFollowupMigrationSql).toContain("'emoji'")
    expect(emojiFollowupMigrationSql).toMatch(/'kind',\s+1,/)
    expect(emojiFollowupMigrationSql).toContain("'unicodeSequence'")
    expect(emojiFollowupMigrationSql).toContain("WHEN 'emojiCustom' THEN")
    expect(emojiFollowupMigrationSql).toMatch(/'kind',\s+2,/)
    expect(emojiFollowupMigrationSql).toContain("'shortcode'")
    expect(emojiFollowupMigrationSql).toContain('UPDATE "forum_topic" AS topic')
    expect(emojiFollowupMigrationSql).not.toContain("'imageUrl'")
    expect(emojiFollowupMigrationSql).not.toContain("'staticUrl'")
    expect(emojiFollowupMigrationSql).not.toContain("'isAnimated'")
    expect(emojiFollowupMigrationSql).not.toContain("'ariaLabel'")
    expect(commentsSql).toContain(
      'COMMENT ON COLUMN "public"."forum_topic"."content_preview"',
    )
  })
})
