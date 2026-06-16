import * as schema from '@db/schema'
import { sql } from 'drizzle-orm'
import { FollowTargetTypeEnum } from './follow.constant'
import { FollowService } from './follow.service'

type SelectRowsSpec = unknown[] | { rows: unknown[]; terminalWhere: true }

function createSelectChain(rows: unknown[], terminalWhere = false) {
  const chain = {
    from: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    offset: jest.fn(async () => rows),
    orderBy: jest.fn(() => chain),
    where: terminalWhere ? jest.fn(async () => rows) : jest.fn(() => chain),
  }

  return chain
}

function createSubject(rowsQueue: SelectRowsSpec[], total = 2) {
  const pageQuery = {
    limit: 1,
    offset: 1,
    pageIndex: 2,
    pageSize: 1,
  }
  const selectChains = rowsQueue.map((spec) =>
    Array.isArray(spec)
      ? createSelectChain(spec)
      : createSelectChain(spec.rows, true),
  )
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
      select: jest.fn(() => selectChains.shift()),
    },
    schema,
  }
  const service = new (FollowService as any)({}, {}, drizzle) as FollowService

  return { drizzle, pageQuery, selectChains, service }
}

function registerResolver(
  service: FollowService,
  targetType: FollowTargetTypeEnum,
  detailMap: Map<number, unknown>,
) {
  const batchGetDetails = jest.fn(async () => detailMap)
  service.registerResolver({
    targetType,
    ensureExists: jest.fn(),
    applyCountDelta: jest.fn(),
    batchGetDetails,
  })
  return batchGetDetails
}

describe('FollowService app page contract', () => {
  it('returns followed authors with offset pagination and target details', async () => {
    const rows = [
      {
        id: 102,
        userId: 33,
        targetType: FollowTargetTypeEnum.AUTHOR,
        targetId: 201,
        createdAt: new Date('2026-06-02T00:00:00.000Z'),
      },
    ]
    const { drizzle, pageQuery, selectChains, service } = createSubject([rows])
    registerResolver(
      service,
      FollowTargetTypeEnum.AUTHOR,
      new Map([[201, { id: 201, name: 'Author' }]]),
    )
    const pageChain = selectChains[0]

    const page = await service.getFollowedAuthorPage({
      userId: 33,
      pageIndex: 2,
      pageSize: 1,
    })

    expect(drizzle.buildPageParams).toHaveBeenCalledWith(
      expect.objectContaining({ pageIndex: 2, pageSize: 1, userId: 33 }),
      expect.any(Object),
    )
    expect(pageChain.orderBy).toHaveBeenCalled()
    expect(pageChain.limit).toHaveBeenCalledWith(pageQuery.limit)
    expect(pageChain.offset).toHaveBeenCalledWith(pageQuery.offset)
    expect(drizzle.db.$count).toHaveBeenCalledWith(
      schema.userFollow,
      expect.anything(),
    )
    expect(page).toMatchObject({
      list: [
        { id: 102, author: { id: 201, name: 'Author', isFollowed: true } },
      ],
      total: 2,
      pageIndex: 2,
      pageSize: 1,
    })
    expect(page).not.toHaveProperty('hasMore')
    expect(page).not.toHaveProperty('nextCursor')
  })

  it('returns followed sections and hashtags with stable page envelopes', async () => {
    const sectionRows = [
      {
        id: 202,
        userId: 33,
        targetType: FollowTargetTypeEnum.FORUM_SECTION,
        targetId: 301,
        createdAt: new Date('2026-06-02T00:00:00.000Z'),
      },
    ]
    const hashtagRows = [
      {
        id: 203,
        userId: 33,
        targetType: FollowTargetTypeEnum.FORUM_HASHTAG,
        targetId: 401,
        createdAt: new Date('2026-06-03T00:00:00.000Z'),
      },
    ]
    const { service } = createSubject([sectionRows, hashtagRows])
    registerResolver(
      service,
      FollowTargetTypeEnum.FORUM_SECTION,
      new Map([[301, { id: 301, name: 'Section' }]]),
    )
    registerResolver(
      service,
      FollowTargetTypeEnum.FORUM_HASHTAG,
      new Map([[401, { id: 401, name: 'Hashtag' }]]),
    )

    const sectionPage = await service.getFollowedSectionPage({
      userId: 33,
      pageIndex: 2,
      pageSize: 1,
    })
    const hashtagPage = await service.getFollowedHashtagPage({
      userId: 33,
      pageIndex: 2,
      pageSize: 1,
    })

    expect(sectionPage).toMatchObject({
      list: [
        { id: 202, section: { id: 301, name: 'Section', isFollowed: true } },
      ],
      total: 2,
      pageIndex: 2,
      pageSize: 1,
    })
    expect(hashtagPage).toMatchObject({
      list: [{ id: 203, hashtag: { id: 401, name: 'Hashtag' } }],
      total: 2,
      pageIndex: 2,
      pageSize: 1,
    })
    expect(sectionPage).not.toHaveProperty('hasMore')
    expect(hashtagPage).not.toHaveProperty('nextCursor')
  })

  it('returns following users with mutual flags', async () => {
    const rows = [
      {
        id: 302,
        userId: 33,
        targetType: FollowTargetTypeEnum.USER,
        targetId: 44,
        createdAt: new Date('2026-06-02T00:00:00.000Z'),
      },
    ]
    const { service } = createSubject([
      rows,
      { rows: [{ userId: 44 }], terminalWhere: true },
    ])
    registerResolver(
      service,
      FollowTargetTypeEnum.USER,
      new Map([[44, { id: 44, nickname: 'Target' }]]),
    )

    const page = await service.getFollowingUserPage({
      userId: 33,
      pageIndex: 2,
      pageSize: 1,
    })

    expect(page).toMatchObject({
      list: [
        {
          id: 302,
          user: { id: 44, nickname: 'Target' },
          isFollowing: true,
          isFollowedByTarget: true,
          isMutualFollow: true,
        },
      ],
      total: 2,
      pageIndex: 2,
      pageSize: 1,
    })
    expect(page).not.toHaveProperty('hasMore')
    expect(page).not.toHaveProperty('nextCursor')
  })

  it('returns follower users with mutual flags and empty pages without resolver calls', async () => {
    const rows = [
      {
        id: 402,
        userId: 44,
        targetType: FollowTargetTypeEnum.USER,
        targetId: 33,
        createdAt: new Date('2026-06-02T00:00:00.000Z'),
      },
    ]
    const { service: followerService } = createSubject([
      rows,
      { rows: [{ targetId: 44 }], terminalWhere: true },
    ])
    registerResolver(
      followerService,
      FollowTargetTypeEnum.USER,
      new Map([[44, { id: 44, nickname: 'Follower' }]]),
    )

    const page = await followerService.getFollowerUserPage({
      userId: 33,
      pageIndex: 2,
      pageSize: 1,
    })

    expect(page).toMatchObject({
      list: [
        {
          id: 402,
          user: { id: 44, nickname: 'Follower' },
          isFollowing: true,
          isFollowedByTarget: true,
          isMutualFollow: true,
        },
      ],
      total: 2,
      pageIndex: 2,
      pageSize: 1,
    })
    expect(page).not.toHaveProperty('nextCursor')

    const { service: emptyService } = createSubject([[]])
    const batchGetDetails = registerResolver(
      emptyService,
      FollowTargetTypeEnum.AUTHOR,
      new Map(),
    )
    const emptyPage = await emptyService.getFollowedAuthorPage({
      userId: 33,
      pageIndex: 2,
      pageSize: 1,
    })

    expect(emptyPage).toEqual({
      list: [],
      total: 2,
      pageIndex: 2,
      pageSize: 1,
    })
    expect(batchGetDetails).not.toHaveBeenCalled()
  })
})
