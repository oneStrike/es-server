import { BadRequestException } from '@nestjs/common'
import { getTableColumns } from 'drizzle-orm'
import { DrizzleService } from '../../../../db/core/drizzle.service'
import { buildDrizzlePageQuery } from '../../../../db/core/query/page-query'
import { findPagination } from '../../../../db/extensions/findPagination'
import { requestLog } from '../../../../db/schema/system/request-log'

function createDrizzleService() {
  return new DrizzleService(
    {} as any,
    { end: jest.fn() } as any,
    { get: jest.fn().mockReturnValue(undefined) } as any,
  )
}

describe('buildDrizzlePageQuery', () => {
  it('defaults to the first page with a 1-based pageIndex', () => {
    const pageQuery = buildDrizzlePageQuery()

    expect(pageQuery.pageIndex).toBe(1)
    expect(pageQuery.offset).toBe(0)
    expect(pageQuery.pageSize).toBe(15)
  })

  it('translates 1-based pageIndex values into 0-based offsets', () => {
    expect(buildDrizzlePageQuery({ pageIndex: 0, pageSize: 10 })).toMatchObject({
      pageIndex: 1,
      offset: 0,
    })

    expect(buildDrizzlePageQuery({ pageIndex: 1, pageSize: 10 })).toMatchObject({
      pageIndex: 1,
      offset: 0,
    })

    expect(buildDrizzlePageQuery({ pageIndex: 2, pageSize: 10 })).toMatchObject({
      pageIndex: 2,
      offset: 10,
    })

    expect(buildDrizzlePageQuery({ pageIndex: '3', pageSize: 10 })).toMatchObject({
      pageIndex: 3,
      offset: 20,
    })
  })

  it('clamps pageSize to the configured maxPageSize', () => {
    const pageQuery = buildDrizzlePageQuery(
      { pageSize: 999 },
      { maxPageSize: 100 },
    )

    expect(pageQuery.pageSize).toBe(100)
  })

  it('adds a stable id sort when sorting by a non-unique field', () => {
    const pageQuery = buildDrizzlePageQuery(
      {
        orderBy: { createdAt: 'desc' },
      },
      {
        table: requestLog,
      },
    )

    expect(pageQuery.orderBy).toEqual([
      { createdAt: 'desc' },
      { id: 'desc' },
    ])
    expect(pageQuery.orderBySql).toHaveLength(2)
  })

  it('preserves an explicit id sort without appending duplicates', () => {
    const pageQuery = buildDrizzlePageQuery(
      {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
      {
        table: requestLog,
      },
    )

    expect(pageQuery.orderBy).toEqual([
      { createdAt: 'asc' },
      { id: 'asc' },
    ])
    expect(pageQuery.orderBySql).toHaveLength(2)
  })

  it('rejects malformed orderBy JSON', () => {
    expect(() =>
      buildDrizzlePageQuery(
        { orderBy: '{bad-json' },
        { table: requestLog },
      ),
    ).toThrow(BadRequestException)
  })

  it('rejects unknown orderBy fields', () => {
    expect(() =>
      buildDrizzlePageQuery(
        { orderBy: { unknownField: 'desc' } },
        { table: requestLog },
      ),
    ).toThrow('排序字段 "unknownField" 不存在')
  })

  it('rejects invalid order directions', () => {
    expect(() =>
      buildDrizzlePageQuery(
        { orderBy: { createdAt: 'sideways' } },
        { table: requestLog },
      ),
    ).toThrow('排序字段 "createdAt" 的排序方向无效')
  })

  it('rejects empty orderBy objects and arrays', () => {
    expect(() =>
      buildDrizzlePageQuery(
        { orderBy: {} },
        { table: requestLog },
      ),
    ).toThrow('orderBy 不能为空')

    expect(() =>
      buildDrizzlePageQuery(
        { orderBy: [] },
        { table: requestLog },
      ),
    ).toThrow('orderBy 不能为空')
  })
})

describe('findPagination option guards', () => {
  it('rejects using pick and omit together', async () => {
    await expect(
      findPagination({} as any, requestLog, {
        pick: ['id'] as const,
        omit: ['createdAt'] as const,
      }),
    ).rejects.toThrow('不支持 pick 和 omit 同时使用')
  })

  it('rejects pick fields that do not exist', async () => {
    await expect(
      findPagination({} as any, requestLog, {
        pick: ['missingField'] as any,
      }),
    ).rejects.toThrow('pick 字段不存在: missingField')
  })

  it('rejects omit fields that do not exist', async () => {
    await expect(
      findPagination({} as any, requestLog, {
        omit: ['missingField'] as any,
      }),
    ).rejects.toThrow('omit 字段不存在: missingField')
  })

  it('rejects omit when it removes all selectable fields', async () => {
    await expect(
      findPagination({} as any, requestLog, {
        omit: Object.keys(getTableColumns(requestLog)) as any,
      }),
    ).rejects.toThrow('findPagination options.omit removes all selectable fields')
  })
})

describe('DrizzleService pagination helpers', () => {
  const drizzle = createDrizzleService()

  it('builds pagination bounds without using page-query helpers', () => {
    expect(
      drizzle.buildPaginationBounds({
        pageIndex: 2,
        pageSize: 10,
      }),
    ).toEqual({
      pageIndex: 2,
      pageSize: 10,
      limit: 10,
      offset: 10,
    })
  })

  it('respects maxPageSize when building pagination bounds', () => {
    expect(
      drizzle.buildPaginationBounds(
        { pageSize: 999 },
        { maxPageSize: 100 },
      ),
    ).toMatchObject({
      pageIndex: 1,
      pageSize: 100,
      limit: 100,
      offset: 0,
    })
  })

  it('builds validated orderBy SQL for a table', () => {
    const result = drizzle.buildTableOrderBy(
      requestLog,
      { createdAt: 'desc' },
    )

    expect(result.orderBy).toEqual([
      { createdAt: 'desc' },
      { id: 'desc' },
    ])
    expect(result.orderBySql).toHaveLength(2)
  })

  it('rejects invalid table orderBy input', () => {
    expect(() =>
      drizzle.buildTableOrderBy(
        requestLog,
        { missingField: 'desc' },
      ),
    ).toThrow('排序字段 "missingField" 不存在')
  })
})
