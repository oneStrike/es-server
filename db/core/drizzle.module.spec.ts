import 'reflect-metadata'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as dbCore from './index'
import { DbNotificationService } from './db-notification.service'
import { DrizzleModule } from './drizzle.module'
import { DRIZZLE_POOL } from './drizzle.provider'
import { DrizzleService } from './drizzle.service'

describe('DrizzleModule public contract', () => {
  it('exports only the stable Nest providers', () => {
    const exportedProviders = Reflect.getMetadata(
      'exports',
      DrizzleModule,
    ) as unknown[]

    expect(exportedProviders).toEqual(
      expect.arrayContaining([DrizzleService, DbNotificationService]),
    )
    expect(exportedProviders).not.toContain(DRIZZLE_POOL)
  })

  it('keeps the public barrel aligned with the approved allowlist', () => {
    const barrelSource = readFileSync(resolve(__dirname, 'index.ts'), 'utf8')

    expect(barrelSource).toContain(
      "export { DbNotificationService } from './db-notification.service'",
    )
    expect(barrelSource).toContain(
      "export { DrizzleModule } from './drizzle.module'",
    )
    expect(barrelSource).toContain(
      "export { DrizzleService } from './drizzle.service'",
    )
    expect(barrelSource).toContain('DrizzleMutationResult')
    expect(barrelSource).toContain('PgTable')
    expect(barrelSource).toContain('SQL')
    expect(barrelSource).toContain('TableConfig')
    expect(barrelSource).toContain(
      "export { extractError } from './error/error-handler'",
    )
    expect(barrelSource).toContain(
      "export { getPostgresErrorResponseDescriptor } from './error/postgres-error'",
    )
    expect(barrelSource).toContain(
      "export { buildILikeCondition, buildLikePattern } from './query/like-pattern'",
    )
    expect(barrelSource).toContain(
      "export { toPageResult } from './query/page-result'",
    )
    expect(barrelSource).toContain(
      "export { extractRows } from './query/raw-result.helper'",
    )
    expect(barrelSource).not.toMatch(/DrizzleErrorMessages/)
    expect(barrelSource).not.toMatch(/export\s+type\s+\{\s*PostgresError\s*\}/)
    expect(barrelSource).not.toMatch(/SQLWrapper/)
  })

  it('keeps runtime helper exports reachable through @db/core', () => {
    expect(dbCore.DbNotificationService).toBe(DbNotificationService)
    expect(dbCore.DrizzleModule).toBe(DrizzleModule)
    expect(dbCore.DrizzleService).toBe(DrizzleService)
    expect(typeof dbCore.buildILikeCondition).toBe('function')
    expect(typeof dbCore.buildLikePattern).toBe('function')
    expect(typeof dbCore.extractError).toBe('function')
    expect(typeof dbCore.extractRows).toBe('function')
    expect(typeof dbCore.getPostgresErrorResponseDescriptor).toBe('function')
    expect(typeof dbCore.toPageResult).toBe('function')
    expect(dbCore).not.toHaveProperty('DRIZZLE_POOL')
  })
})
