import { resolveDbQueryConfig } from '@libs/platform/config/db.config';
import { BadRequestException } from '@nestjs/common'
import { getTableColumns } from 'drizzle-orm'
import { DrizzleService } from '../../../../../db/core/drizzle.service'
import { buildDrizzleOrderBy } from '../../../../../db/core/query/order-by'
import { buildDrizzlePageQuery } from '../../../../../db/core/query/page-query'
import { findPagination } from '../../../../../db/extensions/findPagination'
import { systemRequestLog } from '../../../../../db/schema/system/system-request-log'

const defaultPageQueryConfig = resolveDbQueryConfig()

function createTestDrizzleService() {
  const service = Object.create(DrizzleService.prototype) as DrizzleService
  ;(service as any).queryConfig = defaultPageQueryConfig
  return service
}

describe('buildDrizzleOrderBy', () => {
  it('can be reused by non-pagination queries', () => {
    const result = buildDrizzleOrderBy(undefined, {
      table: systemRequestLog,
      fallbackOrderBy: { createdAt: 'desc' },
    })

    expect(result.orderBy).toEqual({
      createdAt: 'desc',
      id: 'desc',
    })
    expect(result.orderBySql).toHaveLength(2)
  })

  it('adds a stable id sort when sorting by a non-unique field', () => {
    const orderQuery = buildDrizzleOrderBy(
      { createdAt: 'desc' },
      {
        table: systemRequestLog,
      },
    )

    expect(orderQuery.orderBy).toEqual({
      createdAt: 'desc',
      id: 'desc',
    })
    expect(orderQuery.orderBySql).toHaveLength(2)
  })

  it('merges array orderBy input into a single RQB v2 orderBy object', () => {
    const orderQuery = buildDrizzleOrderBy(
      [{ createdAt: 'asc' }, { id: 'asc' }],
      {
        table: systemRequestLog,
      },
    )

    expect(orderQuery.orderBy).toEqual({
      createdAt: 'asc',
      id: 'asc',
    })
    expect(orderQuery.orderBySql).toHaveLength(2)
  })

  it('memoizes relation orderBy and SQL outputs after first access', () => {
    const orderQuery = buildDrizzleOrderBy(
      { createdAt: 'desc' },
      { table: systemRequestLog },
    )

    expect(orderQuery.orderBy).toBe(orderQuery.orderBy)
    expect(orderQuery.orderBySql).toBe(orderQuery.orderBySql)
  })

  it('rejects malformed orderBy JSON', () => {
    expect(() =>
      buildDrizzleOrderBy('{bad-json', { table: systemRequestLog }),
    ).toThrow(BadRequestException)
  })

  it('rejects unknown orderBy fields', () => {
    expect(() =>
      buildDrizzleOrderBy(
        { unknownField: 'desc' },
        { table: systemRequestLog },
      ),
    ).toThrow('排序字段 "unknownField" 不存在')
  })

  it('rejects invalid order directions', () => {
    expect(() =>
      buildDrizzleOrderBy(
        { createdAt: 'sideways' },
        { table: systemRequestLog },
      ),
    ).toThrow('排序字段 "createdAt" 的排序方向无效')
  })

  it('rejects empty orderBy objects and arrays', () => {
    expect(() =>
      buildDrizzleOrderBy({}, { table: systemRequestLog }),
    ).toThrow('orderBy 不能为空')

    expect(() =>
      buildDrizzleOrderBy([], { table: systemRequestLog }),
    ).toThrow('orderBy 不能为空')
  })

  it('rejects duplicate fields across array orderBy input', () => {
    expect(() =>
      buildDrizzleOrderBy(
        [{ createdAt: 'desc' }, { createdAt: 'asc' }],
        { table: systemRequestLog },
      ),
    ).toThrow('排序字段 "createdAt" 重复')
  })
})

describe('buildDrizzlePageQuery', () => {
  it('defaults to the first page with a 1-based pageIndex', () => {
    const pageQuery = buildDrizzlePageQuery({}, {
      defaultPageIndex: defaultPageQueryConfig.pageIndex,
      defaultPageSize: defaultPageQueryConfig.pageSize,
      maxPageSize: defaultPageQueryConfig.maxListItemLimit,
    })

    expect(pageQuery.pageIndex).toBe(1)
    expect(pageQuery.offset).toBe(0)
    expect(pageQuery.pageSize).toBe(15)
  })

  it('translates 1-based pageIndex values into 0-based offsets', () => {
    expect(buildDrizzlePageQuery(
      { pageIndex: 0, pageSize: 10 },
      {
        defaultPageIndex: defaultPageQueryConfig.pageIndex,
        defaultPageSize: defaultPageQueryConfig.pageSize,
        maxPageSize: defaultPageQueryConfig.maxListItemLimit,
      },
    )).toMatchObject({
      pageIndex: 1,
      offset: 0,
    })

    expect(buildDrizzlePageQuery(
      { pageIndex: 1, pageSize: 10 },
      {
        defaultPageIndex: defaultPageQueryConfig.pageIndex,
        defaultPageSize: defaultPageQueryConfig.pageSize,
        maxPageSize: defaultPageQueryConfig.maxListItemLimit,
      },
    )).toMatchObject({
      pageIndex: 1,
      offset: 0,
    })

    expect(buildDrizzlePageQuery(
      { pageIndex: 2, pageSize: 10 },
      {
        defaultPageIndex: defaultPageQueryConfig.pageIndex,
        defaultPageSize: defaultPageQueryConfig.pageSize,
        maxPageSize: defaultPageQueryConfig.maxListItemLimit,
      },
    )).toMatchObject({
      pageIndex: 2,
      offset: 10,
    })

    expect(buildDrizzlePageQuery(
      { pageIndex: '3', pageSize: 10 },
      {
        defaultPageIndex: defaultPageQueryConfig.pageIndex,
        defaultPageSize: defaultPageQueryConfig.pageSize,
        maxPageSize: defaultPageQueryConfig.maxListItemLimit,
      },
    )).toMatchObject({
      pageIndex: 3,
      offset: 20,
    })
  })

  it('clamps pageSize to the configured maxPageSize', () => {
    const pageQuery = buildDrizzlePageQuery(
      { pageSize: 999 },
      {
        defaultPageIndex: defaultPageQueryConfig.pageIndex,
        defaultPageSize: defaultPageQueryConfig.pageSize,
        maxPageSize: 100,
      },
    )

    expect(pageQuery.pageSize).toBe(100)
  })
})

describe('drizzle service query helpers', () => {
  it('reuses repository defaults when building page params', () => {
    const drizzle = createTestDrizzleService()

    expect(
      drizzle.buildPage({ pageIndex: '2' }),
    ).toMatchObject({
      pageIndex: 2,
      pageSize: defaultPageQueryConfig.pageSize,
      limit: defaultPageQueryConfig.pageSize,
      offset: defaultPageQueryConfig.pageSize,
    })
  })

  it('reuses service-level fallback sorting for manual queries', () => {
    const drizzle = createTestDrizzleService()

    const order = drizzle.buildOrderBy(undefined, {
      table: systemRequestLog,
      fallbackOrderBy: { createdAt: 'desc' },
    })

    expect(order.orderBy).toEqual({
      createdAt: 'desc',
      id: 'desc',
    })
    expect(order.orderBySql).toHaveLength(2)
  })
})

describe('findPagination option guards', () => {
  it('rejects using pick and omit together', async () => {
    await expect(
      findPagination({} as any, systemRequestLog, {
        pick: ['id'] as const,
        omit: ['createdAt'] as const,
      }),
    ).rejects.toThrow('不支持 pick 和 omit 同时使用')
  })

  it('rejects pick fields that do not exist', async () => {
    await expect(
      findPagination({} as any, systemRequestLog, {
        pick: ['missingField'] as any,
      }),
    ).rejects.toThrow('pick 字段不存在: missingField')
  })

  it('rejects omit fields that do not exist', async () => {
    await expect(
      findPagination({} as any, systemRequestLog, {
        omit: ['missingField'] as any,
      }),
    ).rejects.toThrow('omit 字段不存在: missingField')
  })

  it('rejects omit when it removes all selectable fields', async () => {
    await expect(
      findPagination({} as any, systemRequestLog, {
        omit: Object.keys(getTableColumns(systemRequestLog)) as any,
      }),
    ).rejects.toThrow('findPagination options.omit removes all selectable fields')
  })
})
