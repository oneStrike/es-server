/// <reference types="jest" />

import { workCategory } from '@db/schema'
import { BadRequestException } from '@nestjs/common'
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
    limit: jest.fn(async () => rows),
  }
  const drizzle = {
    db: {
      select: jest.fn(() => query),
      $count: jest.fn(),
    },
    schema: {
      workCategory,
      workCategoryRelation: {},
      work: {},
    },
    buildPage: jest.fn((queryDto: { pageSize?: number }) => ({
      limit: queryDto.pageSize ?? 15,
      offset: 0,
      pageIndex: 1,
      pageSize: queryDto.pageSize ?? 15,
    })),
  }

  return {
    drizzle,
    query,
    service: new WorkCategoryService(drizzle as never) as any,
  }
}

describe('WorkCategoryService app cursor pagination', () => {
  it('uses sortOrder/id cursor result shape without exact count', async () => {
    const rows = [
      createCategory({ id: 10, name: 'A', sortOrder: 1 }),
      createCategory({ id: 11, name: 'B', sortOrder: 1 }),
      createCategory({ id: 12, name: 'C', sortOrder: 1 }),
    ]
    const { drizzle, query, service } = createSubject(rows)

    const result = await service.getAppCategoryCursorPage({ pageSize: 2 })
    const decodedCursor = JSON.parse(
      Buffer.from(result.nextCursor, 'base64url').toString('utf8'),
    )

    expect(result).toMatchObject({
      pageSize: 2,
      hasMore: true,
      list: [
        { id: 10, sortOrder: 1 },
        { id: 11, sortOrder: 1 },
      ],
    })
    expect(result).not.toHaveProperty('total')
    expect(result).not.toHaveProperty('pageIndex')
    expect(decodedCursor).toEqual({
      sortOrder: 1,
      id: 11,
      context: {
        name: null,
        contentType: [],
      },
    })
    expect(query.limit).toHaveBeenCalledWith(3)
    expect(query.orderBy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
    )
    expect(drizzle.db.$count).not.toHaveBeenCalled()
  })

  it('rejects invalid app category cursors', () => {
    const { service } = createSubject([])

    expect(() => service.parseCategoryCursor('not-base64-json')).toThrow(
      BadRequestException,
    )
  })

  it('rejects app category cursors when filter context changes', () => {
    const { service } = createSubject([])
    const context = service.buildCategoryCursorContext({
      name: '  Manga ',
      contentType: '[2,1,2]',
    })
    const cursor = service.encodeCategoryCursor(
      createCategory({ id: 11, sortOrder: 1 }),
      context,
    )

    expect(
      service.parseCategoryCursor(
        cursor,
        service.buildCategoryCursorContext({
          name: 'manga',
          contentType: '[1,2]',
        }),
      ),
    ).toEqual({ sortOrder: 1, id: 11 })
    expect(() =>
      service.parseCategoryCursor(
        cursor,
        service.buildCategoryCursorContext({
          name: 'novel',
          contentType: '[1,2]',
        }),
      ),
    ).toThrow('查询条件不匹配')
  })
})
