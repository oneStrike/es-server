import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('work tag relation sort order migration', () => {
  const sql = readFileSync(join(__dirname, 'migration.sql'), 'utf8')

  it('adds a non-null sort_order column with a zero default', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL')
  })

  it('creates the relation read index used by ordered tag attachment', () => {
    expect(sql).toContain(
      'ON "work_tag_relation" ("work_id", "sort_order", "tag_id")',
    )
  })
})

