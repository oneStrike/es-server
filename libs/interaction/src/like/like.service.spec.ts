import * as schema from '@db/schema'
import { sql } from 'drizzle-orm'
import { LikeTargetTypeEnum } from './like.constant'
import { LikeService } from './like.service'

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
  const service = new (LikeService as any)({}, {}, {}, drizzle) as LikeService

  return { drizzle, pageQuery, selectChain, service }
}

describe('LikeService app page contract', () => {
  it('returns user likes with target details and offset pagination', async () => {
    const rows = [
      {
        id: 102,
        userId: 33,
        targetType: LikeTargetTypeEnum.WORK_COMIC,
        targetId: 201,
        sceneType: 1,
        sceneId: 201,
        commentLevel: undefined,
        createdAt: new Date('2026-06-02T00:00:00.000Z'),
      },
    ]
    const { drizzle, pageQuery, selectChain, service } = createSubject(rows)
    service.registerResolver({
      targetType: LikeTargetTypeEnum.WORK_COMIC,
      resolveMeta: jest.fn(),
      applyCountDelta: jest.fn(),
      batchGetDetails: jest.fn(
        async () =>
          new Map([[201, { id: 201, name: 'Comic', cover: 'cover.jpg' }]]),
      ),
    })

    const page = await service.getUserLikes({
      userId: 33,
      targetType: LikeTargetTypeEnum.WORK_COMIC,
      pageIndex: 2,
      pageSize: 1,
    })

    expect(drizzle.buildPageParams).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 33,
        targetType: LikeTargetTypeEnum.WORK_COMIC,
        pageIndex: 2,
        pageSize: 1,
      }),
      expect.any(Object),
    )
    expect(selectChain.orderBy).toHaveBeenCalled()
    expect(selectChain.limit).toHaveBeenCalledWith(pageQuery.limit)
    expect(selectChain.offset).toHaveBeenCalledWith(pageQuery.offset)
    expect(drizzle.db.$count).toHaveBeenCalledWith(
      schema.userLike,
      expect.anything(),
    )
    expect(page).toMatchObject({
      total: 2,
      pageIndex: 2,
      pageSize: 1,
      list: [
        {
          id: 102,
          commentLevel: null,
          targetDetail: { id: 201, name: 'Comic', cover: 'cover.jpg' },
        },
      ],
    })
    expect(page.list.map((item) => item.id)).toEqual([102])
    expect(page).not.toHaveProperty('hasMore')
    expect(page).not.toHaveProperty('nextCursor')
  })

  it('returns empty user likes without resolving details', async () => {
    const { service } = createSubject([])
    const batchGetDetails = jest.fn()
    service.registerResolver({
      targetType: LikeTargetTypeEnum.WORK_COMIC,
      resolveMeta: jest.fn(),
      applyCountDelta: jest.fn(),
      batchGetDetails,
    })

    const page = await service.getUserLikes({
      userId: 33,
      targetType: LikeTargetTypeEnum.WORK_COMIC,
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
