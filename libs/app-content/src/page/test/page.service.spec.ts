import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PgDialect } from 'drizzle-orm/pg-core'

jest.mock('@db/core', () => ({
  buildILikeCondition: jest.fn((_column: unknown, value?: string) =>
    value ? { type: 'ilike', value } : undefined,
  ),
  DrizzleService: class {},
}))

const dialect = new PgDialect()

describe('app page service', () => {
  it('defaults enablePlatform to all supported platforms', async () => {
    const { appPage } = await import('@db/schema/app/app-page')

    expect(appPage.enablePlatform.hasDefault).toBe(true)
    expect(appPage.enablePlatform.notNull).toBe(false)
    expect(
      dialect.sqlToQuery(appPage.enablePlatform.default as any).sql,
    ).toBe('ARRAY[1,2,3]::integer[]')
  })

  it('uses PostgreSQL array overlap when filtering enablePlatform', async () => {
    const { appPage } = await import('@db/schema/app/app-page')
    const { AppPageService } = await import('../page.service')

    const findPagination = jest.fn().mockResolvedValue(undefined)
    const service = new AppPageService({
      db: {},
      ext: { findPagination },
      schema: { appPage },
    } as any)

    await service.findPage({ enablePlatform: '[1,2]' } as any)

    const queryOptions = findPagination.mock.calls[0]?.[1]
    const renderWhere = () => dialect.sqlToQuery(queryOptions.where)

    expect(renderWhere).not.toThrow()
    const whereSql = renderWhere()
    expect(whereSql.sql).toContain('"app_page"."enablePlatform" &&')
    expect(whereSql.sql).not.toContain(' in ')
    expect(whereSql.params).toEqual(['{1,2}'])
  })

  it('keeps access level docs aligned with the page VIP contract', async () => {
    const dtoSource = readFileSync(
      resolve(process.cwd(), 'libs/app-content/src/page/dto/page.dto.ts'),
      'utf8',
    )
    const schemaSource = readFileSync(
      resolve(process.cwd(), 'db/schema/app/app-page.ts'),
      'utf8',
    )
    const generatedComments = readFileSync(
      resolve(process.cwd(), 'db/comments/generated.sql'),
      'utf8',
    )

    expect(dtoSource).toContain('页面权限级别（0=游客；1=登录；2=会员；3=高级会员）')
    expect(schemaSource).toContain('访问级别（0=游客, 1=登录, 2=会员, 3=高级会员）')
    expect(generatedComments).toContain('访问级别（0=游客, 1=登录, 2=会员, 3=高级会员）')
  })
})
