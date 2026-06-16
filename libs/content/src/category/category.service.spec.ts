/// <reference types="jest" />

import { workCategory } from '@db/schema'
import { WorkCategoryService } from './category.service'

const now = new Date('2026-06-11T00:00:00.000Z')

function createCategory(overrides: Partial<typeof workCategory.$inferSelect>) {
  return {
    id: 1,
    name: '分类',
    description: null,
    icon: null,
    contentType: null,
    sortOrder: 0,
    isEnabled: true,
    popularity: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function createSubject(rows: Array<typeof workCategory.$inferSelect>) {
  const query = {
    from: jest.fn(() => query),
    where: jest.fn(() => query),
    orderBy: jest.fn(() => query),
    limit: jest.fn(() => query),
    offset: jest.fn(async () => rows),
  }
  const drizzle = {
    db: {
      select: jest.fn(() => query),
      $count: jest.fn(async () => 3),
    },
    schema: {
      workCategory,
      workCategoryRelation: {},
      work: {},
    },
    buildPageParams: jest.fn(
      (queryDto: {
        pageIndex?: number
        pageSize?: number
        startDate?: string
        endDate?: string
      }) => ({
        page: {
          limit: queryDto.pageSize ?? 15,
          offset: ((queryDto.pageIndex ?? 1) - 1) * (queryDto.pageSize ?? 15),
          pageIndex: queryDto.pageIndex ?? 1,
          pageSize: queryDto.pageSize ?? 15,
        },
        order: {
          orderBySql: ['sort_order_asc', 'id_asc'],
        },
        dateRange:
          queryDto.startDate || queryDto.endDate
            ? {
                gte: queryDto.startDate
                  ? new Date('2026-06-01T00:00:00.000Z')
                  : undefined,
                lt: queryDto.endDate
                  ? new Date('2026-06-03T00:00:00.000Z')
                  : undefined,
              }
            : undefined,
      }),
    ),
    buildPage: jest.fn(
      (queryDto: { pageIndex?: number; pageSize?: number }) => ({
        limit: queryDto.pageSize ?? 15,
        offset: ((queryDto.pageIndex ?? 1) - 1) * (queryDto.pageSize ?? 15),
        pageIndex: queryDto.pageIndex ?? 1,
        pageSize: queryDto.pageSize ?? 15,
      }),
    ),
    buildOrderBy: jest.fn(() => ({
      orderBySql: ['sort_order_asc', 'id_asc'],
    })),
  }

  return {
    drizzle,
    query,
    service: new WorkCategoryService(drizzle as never) as any,
  }
}

describe('WorkCategoryService app pagination', () => {
  it('returns an offset page with exact count', async () => {
    const rows = [
      createCategory({ id: 10, name: 'A', sortOrder: 1 }),
      createCategory({ id: 11, name: 'B', sortOrder: 1 }),
    ]
    const { drizzle, query, service } = createSubject(rows)

    const result = await service.getAppCategoryPage({
      contentType: '[1]',
      pageIndex: 2,
      pageSize: 2,
      startDate: '2026-06-01',
      endDate: '2026-06-02',
    })

    expect(result).toEqual({
      list: [
        { ...rows[0], contentType: null, description: null, icon: null },
        { ...rows[1], contentType: null, description: null, icon: null },
      ],
      total: 3,
      pageIndex: 2,
      pageSize: 2,
    })
    expect(query.limit).toHaveBeenCalledWith(2)
    expect(query.offset).toHaveBeenCalledWith(2)
    expect(query.orderBy).toHaveBeenCalledWith('sort_order_asc', 'id_asc')
    expect(drizzle.buildPageParams).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: '2026-06-01',
        endDate: '2026-06-02',
      }),
      expect.objectContaining({
        table: workCategory,
        fallbackOrderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      }),
    )
    expect(query.where).toHaveBeenCalledWith(expect.anything())
    expect(drizzle.db.$count).toHaveBeenCalledWith(
      workCategory,
      expect.anything(),
    )
  })
})
