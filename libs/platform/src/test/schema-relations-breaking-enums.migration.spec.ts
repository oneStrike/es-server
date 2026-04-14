import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('schema relations breaking enums migration', () => {
  const migrationPath = join(
    process.cwd(),
    'db',
    'migration',
    '20260414160000_schema_relations_breaking_enums',
    'migration.sql',
  )

  const migrationSql = readFileSync(migrationPath, 'utf8')

  it('rewrites legacy task scene types to stable values before runtime reads them', () => {
    expect(migrationSql).toContain('UPDATE "task"')
    expect(migrationSql).toContain('WHEN "type" = 3 THEN 2')
    expect(migrationSql).toContain('WHEN "type" = 5 THEN 4')
  })

  it('maps known custom request log actions onto standardized action enums', () => {
    expect(migrationSql).toContain(`WHEN "action_type" = 'TASK_CREATE' THEN 3`)
    expect(migrationSql).toContain(
      `WHEN "action_type" = 'SEND_MESSAGE' THEN 3`,
    )
  })
})
