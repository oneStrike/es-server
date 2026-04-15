import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('sensitive word breaking cleanup migration', () => {
  it('会直接清理 legacy regex 词条，再收紧 matchMode 约束', () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        'db',
        'migration',
        '20260415105000_sensitive_word_breaking_cleanup',
        'migration.sql',
      ),
      'utf8',
    )

    expect(sql).toContain('DELETE FROM "sensitive_word"')
    expect(sql).toContain('regex 匹配模式已下线')
    expect(sql).not.toContain('RAISE EXCEPTION')
    expect(sql).not.toContain('SET "match_mode" = 1')
  })
})
