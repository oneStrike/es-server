jest.mock('drizzle-orm', () => {
  const actual = jest.requireActual('drizzle-orm')

  return {
    ...actual,
    and: jest.fn((...args: unknown[]) => ({ type: 'and', args })),
    asc: jest.fn((value: unknown) => ({ type: 'asc', value })),
    desc: jest.fn((value: unknown) => ({ type: 'desc', value })),
    eq: jest.fn((left: unknown, right: unknown) => ({
      type: 'eq',
      left,
      right,
    })),
    inArray: jest.fn((left: unknown, right: unknown) => ({
      type: 'inArray',
      left,
      right,
    })),
    isNull: jest.fn((value: unknown) => ({ type: 'isNull', value })),
    sql: jest.fn(() => 'contentSnippetSql'),
  }
})

import { UserProfileService } from './profile.service'

function createSelectChain(result: unknown) {
  const resultPromise = Promise.resolve(result) as Promise<unknown> & {
    orderBy: jest.Mock
  }
  resultPromise.orderBy = jest.fn().mockReturnValue(resultPromise)

  const chain = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnValue(resultPromise),
  }

  return chain
}

function createImmediateSelectChain(result: unknown) {
  const resultPromise = Promise.resolve(result)

  return {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnValue(resultPromise),
  }
}

describe('UserProfileService', () => {
  it('uses the viewer user id for like and favorite status when querying another user topics', async () => {
    const pageList = [
      {
        id: 11,
        sectionId: 5,
        userId: 7,
        title: '主题标题',
        contentSnippet: '摘要',
        geoCountry: null,
        geoProvince: null,
        geoCity: null,
        geoIsp: null,
        images: [],
        videos: [],
        isPinned: false,
        isFeatured: false,
        isLocked: false,
        viewCount: 10,
        commentCount: 2,
        likeCount: 3,
        favoriteCount: 4,
        lastCommentAt: null,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        auditStatus: 1,
      },
    ]
    const sections = [{ id: 5, name: '板块', icon: null, cover: null }]
    const selectMock = jest
      .fn()
      .mockImplementationOnce(() => createSelectChain(pageList))
      .mockImplementationOnce(() => createImmediateSelectChain(sections))
    const drizzle = {
      db: {
        select: selectMock,
        $count: jest.fn().mockResolvedValue(1),
        query: {
          appUser: {
            findFirst: jest.fn().mockResolvedValue({
              id: 7,
              nickname: '目标用户',
              avatarUrl: null,
            }),
          },
        },
      },
      schema: {
        appUser: {
          id: 'appUser.id',
          nickname: 'appUser.nickname',
          avatarUrl: 'appUser.avatarUrl',
        },
        appUserCount: {},
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
          viewCount: 'forumTopic.viewCount',
          commentCount: 'forumTopic.commentCount',
          likeCount: 'forumTopic.likeCount',
          favoriteCount: 'forumTopic.favoriteCount',
          lastCommentAt: 'forumTopic.lastCommentAt',
          createdAt: 'forumTopic.createdAt',
          auditStatus: 'forumTopic.auditStatus',
          deletedAt: 'forumTopic.deletedAt',
        },
        forumSection: {
          id: 'forumSection.id',
          name: 'forumSection.name',
          icon: 'forumSection.icon',
          cover: 'forumSection.cover',
          deletedAt: 'forumSection.deletedAt',
        },
        growthLedgerRecord: {},
        userAssetBalance: {},
        userBadge: {},
        userBadgeAssignment: {},
        userLevelRule: {},
      },
      buildPage: jest.fn().mockReturnValue({
        pageIndex: 1,
        pageSize: 20,
        limit: 20,
        offset: 0,
      }),
      buildOrderBy: jest.fn().mockReturnValue({
        orderBySql: [],
      }),
    }
    const likeService = {
      checkStatusBatch: jest.fn().mockResolvedValue(new Map([[11, true]])),
    }
    const favoriteService = {
      checkStatusBatch: jest.fn().mockResolvedValue(new Map([[11, false]])),
    }
    const service = new UserProfileService(
      drizzle as never,
      {} as never,
      favoriteService as never,
      likeService as never,
      {} as never,
    )

    const result = await service.getUserTopics(7, 99, {
      pageIndex: 1,
      pageSize: 20,
    })

    expect(likeService.checkStatusBatch).toHaveBeenCalledWith(
      expect.anything(),
      [11],
      99,
    )
    expect(favoriteService.checkStatusBatch).toHaveBeenCalledWith(
      expect.anything(),
      [11],
      99,
    )
    expect(result.list).toEqual([
      expect.objectContaining({
        id: 11,
        liked: true,
        favorited: false,
        user: expect.objectContaining({
          id: 7,
          nickname: '目标用户',
        }),
      }),
    ])
  })
})
