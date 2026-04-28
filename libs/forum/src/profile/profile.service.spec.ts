jest.mock('drizzle-orm', () => ({
  and: jest.fn((...conditions: unknown[]) => ({
    op: 'and',
    conditions: conditions.filter(Boolean),
  })),
  asc: jest.fn((column: unknown) => ({ op: 'asc', column })),
  desc: jest.fn((column: unknown) => ({ op: 'desc', column })),
  eq: jest.fn((column: unknown, value: unknown) => ({
    op: 'eq',
    column,
    value,
  })),
  inArray: jest.fn((column: unknown, values: unknown[]) => ({
    op: 'inArray',
    column,
    values,
  })),
  isNull: jest.fn((column: unknown) => ({ op: 'isNull', column })),
  sql: jest.fn(() => ({ op: 'sql' })),
}))

jest.mock('@db/core', () => ({
  buildILikeCondition: jest.fn(),
  DrizzleService: class {},
}))

import { AuditStatusEnum, GenderEnum } from '@libs/platform/constant'
import { UserStatusEnum } from '@libs/user/app-user.constant'
import { UserProfileService } from './profile.service'

type MockCondition = {
  op: string
  column?: unknown
  value?: unknown
  values?: unknown[]
  conditions?: MockCondition[]
}

describe('UserProfileService', () => {
  const schema = {
    appUser: {
      id: 'appUser.id',
    },
    appUserCount: {
      userId: 'appUserCount.userId',
      commentCount: 'appUserCount.commentCount',
      likeCount: 'appUserCount.likeCount',
      favoriteCount: 'appUserCount.favoriteCount',
      followingUserCount: 'appUserCount.followingUserCount',
      followingAuthorCount: 'appUserCount.followingAuthorCount',
      followingSectionCount: 'appUserCount.followingSectionCount',
      followingHashtagCount: 'appUserCount.followingHashtagCount',
      followersCount: 'appUserCount.followersCount',
      forumTopicCount: 'appUserCount.forumTopicCount',
      commentReceivedLikeCount: 'appUserCount.commentReceivedLikeCount',
      forumTopicReceivedLikeCount: 'appUserCount.forumTopicReceivedLikeCount',
      forumTopicReceivedFavoriteCount:
        'appUserCount.forumTopicReceivedFavoriteCount',
    },
    forumTopic: {
      id: 'forumTopic.id',
      sectionId: 'forumTopic.sectionId',
      userId: 'forumTopic.userId',
      title: 'forumTopic.title',
      content: 'forumTopic.content',
      geoCountry: 'forumTopic.geoCountry',
      geoProvince: 'forumTopic.geoProvince',
      geoCity: 'forumTopic.geoCity',
      geoIsp: 'forumTopic.geoIsp',
      images: 'forumTopic.images',
      videos: 'forumTopic.videos',
      isPinned: 'forumTopic.isPinned',
      isFeatured: 'forumTopic.isFeatured',
      isLocked: 'forumTopic.isLocked',
      isHidden: 'forumTopic.isHidden',
      viewCount: 'forumTopic.viewCount',
      commentCount: 'forumTopic.commentCount',
      likeCount: 'forumTopic.likeCount',
      favoriteCount: 'forumTopic.favoriteCount',
      lastCommentAt: 'forumTopic.lastCommentAt',
      createdAt: 'forumTopic.createdAt',
      deletedAt: 'forumTopic.deletedAt',
      auditStatus: 'forumTopic.auditStatus',
    },
    forumSection: {
      id: 'forumSection.id',
      name: 'forumSection.name',
      icon: 'forumSection.icon',
      cover: 'forumSection.cover',
      deletedAt: 'forumSection.deletedAt',
    },
    growthLedgerRecord: {
      userId: 'growthLedgerRecord.userId',
      assetType: 'growthLedgerRecord.assetType',
    },
    userAssetBalance: {
      userId: 'userAssetBalance.userId',
      assetType: 'userAssetBalance.assetType',
      assetKey: 'userAssetBalance.assetKey',
      balance: 'userAssetBalance.balance',
    },
    userBadge: {
      id: 'userBadge.id',
    },
    userBadgeAssignment: {
      userId: 'userBadgeAssignment.userId',
      badgeId: 'userBadgeAssignment.badgeId',
      createdAt: 'userBadgeAssignment.createdAt',
    },
    userLevelRule: {
      id: 'userLevelRule.id',
      isEnabled: 'userLevelRule.isEnabled',
      sortOrder: 'userLevelRule.sortOrder',
    },
  }

  function createPagedSelectBuilder(result: unknown[]) {
    const query = {
      where: jest.fn(),
      limit: jest.fn(),
      offset: jest.fn(),
      orderBy: jest.fn().mockResolvedValue(result),
    }
    query.where.mockReturnValue(query)
    query.limit.mockReturnValue(query)
    query.offset.mockReturnValue(query)

    return {
      builder: {
        from: jest.fn().mockReturnValue(query),
      },
      query,
    }
  }

  function createResolvedWhereBuilder(result: unknown[]) {
    const query = {
      where: jest.fn().mockResolvedValue(result),
    }

    return {
      builder: {
        from: jest.fn().mockReturnValue(query),
      },
      query,
    }
  }

  function createBadgeBuilder(result: unknown[]) {
    const query = {
      innerJoin: jest.fn(),
      where: jest.fn(),
      orderBy: jest.fn().mockResolvedValue(result),
    }
    query.innerJoin.mockReturnValue(query)
    query.where.mockReturnValue(query)

    return {
      builder: {
        from: jest.fn().mockReturnValue(query),
      },
      query,
    }
  }

  function createService(overrides?: {
    db?: Record<string, unknown>
    buildPage?: jest.Mock
    buildOrderBy?: jest.Mock
    forumPermissionService?: Record<string, unknown>
    likeService?: Record<string, unknown>
    favoriteService?: Record<string, unknown>
    appUserCountService?: Record<string, unknown>
  }) {
    const drizzle = {
      db: overrides?.db ?? {},
      schema,
      ext: {
        findPagination: jest.fn(),
      },
      buildPage:
        overrides?.buildPage ??
        jest.fn().mockReturnValue({
          pageIndex: 1,
          pageSize: 20,
          limit: 20,
          offset: 0,
        }),
      buildOrderBy:
        overrides?.buildOrderBy ??
        jest.fn().mockReturnValue({
          orderBySql: ['createdAt-desc'],
        }),
      withErrorHandling: jest.fn(async (callback: () => Promise<unknown>) =>
        callback(),
      ),
    }

    return new UserProfileService(
      drizzle as never,
      (overrides?.favoriteService ?? {}) as never,
      (overrides?.likeService ?? {}) as never,
      (overrides?.appUserCountService ?? {}) as never,
      (overrides?.forumPermissionService ?? {}) as never,
    )
  }

  it('applies public-topic visibility constraints when reading a public user topic page', async () => {
    const pageList = [
      {
        id: 11,
        sectionId: 3,
        userId: 9,
        title: '公开主题',
        contentSnippet: '公开正文',
        geoCountry: null,
        geoProvince: null,
        geoCity: null,
        geoIsp: null,
        images: [],
        videos: [],
        isPinned: false,
        isFeatured: false,
        isLocked: false,
        viewCount: 1,
        commentCount: 2,
        likeCount: 3,
        favoriteCount: 4,
        lastCommentAt: null,
        createdAt: new Date('2026-04-28T00:00:00.000Z'),
      },
    ]
    const { builder: listBuilder, query: listQuery } =
      createPagedSelectBuilder(pageList)
    const { builder: sectionBuilder } = createResolvedWhereBuilder([
      {
        id: 3,
        name: '公开板块',
        icon: null,
        cover: null,
      },
    ])
    const db = {
      select: jest
        .fn()
        .mockReturnValueOnce(listBuilder)
        .mockReturnValueOnce(sectionBuilder),
      $count: jest.fn().mockResolvedValue(1),
      query: {
        appUser: {
          findFirst: jest.fn().mockResolvedValue({
            id: 9,
            nickname: '楼主',
            avatarUrl: null,
          }),
        },
      },
    }
    const forumPermissionService = {
      getAccessibleSectionIds: jest.fn().mockResolvedValue([3]),
      ensureUserCanAccessSection: jest.fn(),
    }
    const likeService = {
      checkStatusBatch: jest
        .fn()
        .mockResolvedValue(new Map<number, boolean>([[11, true]])),
    }
    const favoriteService = {
      checkStatusBatch: jest
        .fn()
        .mockResolvedValue(new Map<number, boolean>([[11, false]])),
    }
    const service = createService({
      db,
      forumPermissionService,
      likeService,
      favoriteService,
    })

    const result = await service.getPublicUserTopics(9, 1, {
      pageIndex: 1,
      pageSize: 20,
    })

    const whereArg = listQuery.where.mock.calls[0][0] as MockCondition

    expect(forumPermissionService.getAccessibleSectionIds).toHaveBeenCalledWith(
      1,
    )
    expect(whereArg.conditions).toEqual(
      expect.arrayContaining([
        { op: 'eq', column: schema.forumTopic.userId, value: 9 },
        { op: 'isNull', column: schema.forumTopic.deletedAt },
        {
          op: 'eq',
          column: schema.forumTopic.auditStatus,
          value: AuditStatusEnum.APPROVED,
        },
        { op: 'eq', column: schema.forumTopic.isHidden, value: false },
        {
          op: 'inArray',
          column: schema.forumTopic.sectionId,
          values: [3],
        },
      ]),
    )
    expect(result.list).toHaveLength(1)
    expect(result.list[0]).toMatchObject({
      id: 11,
      liked: true,
      favorited: false,
    })
    expect(result.list[0]).not.toHaveProperty('auditStatus')
  })

  it('keeps my topic page unrestricted by public-topic visibility rules', async () => {
    const pageList = [
      {
        id: 12,
        sectionId: 5,
        userId: 9,
        title: '待审核主题',
        contentSnippet: '待审核正文',
        geoCountry: null,
        geoProvince: null,
        geoCity: null,
        geoIsp: null,
        images: [],
        videos: [],
        isPinned: false,
        isFeatured: false,
        isLocked: false,
        viewCount: 0,
        commentCount: 0,
        likeCount: 0,
        favoriteCount: 0,
        lastCommentAt: null,
        createdAt: new Date('2026-04-28T00:00:00.000Z'),
        auditStatus: AuditStatusEnum.PENDING,
      },
    ]
    const { builder: listBuilder, query: listQuery } =
      createPagedSelectBuilder(pageList)
    const { builder: sectionBuilder } = createResolvedWhereBuilder([
      {
        id: 5,
        name: '我的草稿板块',
        icon: null,
        cover: null,
      },
    ])
    const db = {
      select: jest
        .fn()
        .mockReturnValueOnce(listBuilder)
        .mockReturnValueOnce(sectionBuilder),
      $count: jest.fn().mockResolvedValue(1),
      query: {
        appUser: {
          findFirst: jest.fn().mockResolvedValue({
            id: 9,
            nickname: '自己',
            avatarUrl: null,
          }),
        },
      },
    }
    const forumPermissionService = {
      getAccessibleSectionIds: jest.fn(),
      ensureUserCanAccessSection: jest.fn(),
    }
    const likeService = {
      checkStatusBatch: jest
        .fn()
        .mockResolvedValue(new Map<number, boolean>([[12, false]])),
    }
    const favoriteService = {
      checkStatusBatch: jest
        .fn()
        .mockResolvedValue(new Map<number, boolean>([[12, false]])),
    }
    const service = createService({
      db,
      forumPermissionService,
      likeService,
      favoriteService,
    })

    const result = await service.getMyTopics(9, {
      pageIndex: 1,
      pageSize: 20,
    })

    const whereArg = listQuery.where.mock.calls[0][0] as MockCondition

    expect(
      forumPermissionService.getAccessibleSectionIds,
    ).not.toHaveBeenCalled()
    expect(
      forumPermissionService.ensureUserCanAccessSection,
    ).not.toHaveBeenCalled()
    expect(
      whereArg.conditions?.some(
        (condition) => condition.column === schema.forumTopic.auditStatus,
      ),
    ).toBe(false)
    expect(
      whereArg.conditions?.some(
        (condition) => condition.column === schema.forumTopic.isHidden,
      ),
    ).toBe(false)
    expect(result.list[0]).toMatchObject({
      id: 12,
      auditStatus: AuditStatusEnum.PENDING,
    })
  })

  it('returns followingHashtagCount in profile counts', async () => {
    const { builder: growthBuilder } = createResolvedWhereBuilder([
      {
        assetType: 'POINTS',
        balance: 20,
      },
      {
        assetType: 'EXPERIENCE',
        balance: 35,
      },
    ])
    const { builder: countBuilder } = createResolvedWhereBuilder([
      {
        userId: 7,
        commentCount: 1,
        likeCount: 2,
        favoriteCount: 3,
        followingUserCount: 4,
        followingAuthorCount: 5,
        followingSectionCount: 6,
        followingHashtagCount: 7,
        followersCount: 8,
        forumTopicCount: 9,
        commentReceivedLikeCount: 10,
        forumTopicReceivedLikeCount: 11,
        forumTopicReceivedFavoriteCount: 12,
      },
    ])
    const { builder: badgeBuilder } = createBadgeBuilder([])
    const db = {
      select: jest
        .fn()
        .mockReturnValueOnce(growthBuilder)
        .mockReturnValueOnce(countBuilder)
        .mockReturnValueOnce(badgeBuilder),
      query: {
        appUser: {
          findFirst: jest.fn().mockResolvedValue({
            id: 7,
            account: 'user007',
            phoneNumber: null,
            emailAddress: null,
            levelId: null,
            nickname: '用户007',
            avatarUrl: null,
            signature: null,
            bio: null,
            isEnabled: true,
            genderType: GenderEnum.UNKNOWN,
            birthDate: null,
            status: UserStatusEnum.NORMAL,
            banReason: null,
            banUntil: null,
            lastLoginAt: null,
            lastLoginIp: null,
            createdAt: new Date('2026-04-28T00:00:00.000Z'),
            updatedAt: new Date('2026-04-28T00:00:00.000Z'),
            deletedAt: null,
          }),
        },
      },
    }
    const service = createService({
      db,
      forumPermissionService: {},
      likeService: {},
      favoriteService: {},
    })

    const result = await service.getProfile(7)

    expect(result.counts).toMatchObject({
      followingHashtagCount: 7,
      followingSectionCount: 6,
      followingAuthorCount: 5,
    })
  })
})
