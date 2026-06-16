import * as schema from '@db/schema'
import { sql } from 'drizzle-orm'
import { FavoriteTargetTypeEnum } from './favorite.constant'
import { FavoriteService } from './favorite.service'

function createSelectChain(rows: unknown[]) {
  const chain = {
    from: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    offset: jest.fn(async () => rows),
    orderBy: jest.fn(() => chain),
    where: jest.fn(() => chain),
  }

  return chain
}

function createSubject(rows: unknown[] = [], total = 2) {
  const pageQuery = {
    limit: 1,
    offset: 1,
    pageIndex: 2,
    pageSize: 1,
  }
  const selectChain = createSelectChain(rows)
  const drizzle = {
    buildPage: jest.fn(() => pageQuery),
    buildPageParams: jest.fn(() => ({
      page: pageQuery,
      order: {
        orderByClause: sql.raw('created_at desc'),
        orderBySql: [],
      },
      dateRange: undefined,
    })),
    db: {
      $count: jest.fn(async () => total),
      select: jest.fn(() => selectChain),
    },
    schema,
  }
  const service = new (FavoriteService as any)(
    {},
    {},
    {},
    drizzle,
  ) as FavoriteService

  return { drizzle, pageQuery, selectChain, service }
}

describe('FavoriteService app page contract', () => {
  it('returns work favorites with offset pagination and target details', async () => {
    const favoriteRows = [
      {
        id: 102,
        userId: 33,
        targetType: FavoriteTargetTypeEnum.WORK_COMIC,
        targetId: 201,
        createdAt: new Date('2026-06-02T00:00:00.000Z'),
      },
      {
        id: 101,
        userId: 33,
        targetType: FavoriteTargetTypeEnum.WORK_NOVEL,
        targetId: 202,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      },
    ]
    const { drizzle, pageQuery, selectChain, service } =
      createSubject(favoriteRows)
    service.registerResolver({
      targetType: FavoriteTargetTypeEnum.WORK_COMIC,
      ensureExists: jest.fn(),
      applyCountDelta: jest.fn(),
      batchGetDetails: jest.fn(
        async () => new Map([[201, { id: 201, name: 'Comic' }]]),
      ),
    })
    service.registerResolver({
      targetType: FavoriteTargetTypeEnum.WORK_NOVEL,
      ensureExists: jest.fn(),
      applyCountDelta: jest.fn(),
      batchGetDetails: jest.fn(
        async () => new Map([[202, { id: 202, name: 'Novel' }]]),
      ),
    })

    const page = await service.getUserWorkFavorites({
      userId: 33,
      pageIndex: 2,
      pageSize: 1,
    })

    expect(drizzle.buildPageParams).toHaveBeenCalledWith(
      expect.objectContaining({ pageIndex: 2, pageSize: 1, userId: 33 }),
      expect.any(Object),
    )
    expect(selectChain.orderBy).toHaveBeenCalled()
    expect(selectChain.limit).toHaveBeenCalledWith(pageQuery.limit)
    expect(selectChain.offset).toHaveBeenCalledWith(pageQuery.offset)
    expect(drizzle.db.$count).toHaveBeenCalledWith(
      schema.userFavorite,
      expect.anything(),
    )
    expect(page).toMatchObject({
      total: 2,
      pageIndex: 2,
      pageSize: 1,
      list: [
        { id: 102, work: { id: 201, name: 'Comic' } },
        { id: 101, work: { id: 202, name: 'Novel' } },
      ],
    })
    expect(page.list.map((item) => item.id)).toEqual([102, 101])
    expect(page).not.toHaveProperty('hasMore')
    expect(page).not.toHaveProperty('nextCursor')
  })

  it('returns empty topic favorites without resolving details', async () => {
    const { service } = createSubject([])
    const batchGetDetails = jest.fn()
    service.registerResolver({
      targetType: FavoriteTargetTypeEnum.FORUM_TOPIC,
      ensureExists: jest.fn(),
      applyCountDelta: jest.fn(),
      batchGetDetails,
    })

    const page = await service.getUserTopicFavorites({
      userId: 33,
      pageIndex: 2,
      pageSize: 1,
    })

    expect(page).toEqual({
      list: [],
      total: 2,
      pageIndex: 2,
      pageSize: 1,
    })
    expect(batchGetDetails).not.toHaveBeenCalled()
    expect(page).not.toHaveProperty('hasMore')
    expect(page).not.toHaveProperty('nextCursor')
  })
})
