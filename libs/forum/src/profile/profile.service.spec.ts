jest.mock('@db/core', () => ({
  DrizzleService: class {},
  escapeLikePattern: (value: string) => value,
}))

jest.mock('@libs/growth/growth-ledger', () => ({
  GrowthAssetTypeEnum: {
    POINTS: 1,
  },
}))

jest.mock('@libs/growth/point', () => ({
  UserPointService: class {},
}))

jest.mock('@libs/interaction/favorite', () => ({
  FavoriteService: class {},
  FavoriteTargetTypeEnum: {
    FORUM_TOPIC: 3,
  },
}))

jest.mock('@libs/interaction/like', () => ({
  LikeService: class {},
  LikeTargetTypeEnum: {
    FORUM_TOPIC: 3,
  },
}))

jest.mock('@libs/platform/constant', () => ({
  UserDefaults: {
    INITIAL_POINTS: 0,
    INITIAL_EXPERIENCE: 0,
  },
  UserStatusEnum: {
    NORMAL: 1,
  },
}))

jest.mock('@libs/user/core', () => ({
  AppUserCountService: class {},
}))

describe('userProfileService.getMyTopics', () => {
  it('returns unified user interaction fields for self-created topics', async () => {
    const { UserProfileService } = await import('./profile.service')

    const findPagination = jest.fn().mockResolvedValue({
      list: [
        {
          id: 101,
          userId: 7,
          sectionId: null,
          title: '我的主题',
          images: [],
          videos: [],
          isPinned: false,
          isFeatured: false,
          isLocked: false,
          viewCount: 12,
          commentCount: 3,
          likeCount: 2,
          favoriteCount: 1,
          lastCommentAt: new Date('2026-03-29T00:00:00.000Z'),
          createdAt: new Date('2026-03-28T00:00:00.000Z'),
          auditStatus: 1,
        },
      ],
      total: 1,
      pageIndex: 1,
      pageSize: 20,
    })
    const likedStatusBatch = jest
      .fn()
      .mockResolvedValue(new Map([[101, true]]))
    const favoritedStatusBatch = jest
      .fn()
      .mockResolvedValue(new Map([[101, false]]))
    const findFirst = jest.fn().mockResolvedValue({
      id: 7,
      nickname: '测试作者',
      avatarUrl: 'https://example.com/avatar.png',
    })

    const service = new UserProfileService(
      {
        db: {
          query: {
            appUser: {
              findFirst,
            },
          },
        },
        ext: {
          findPagination,
        },
        schema: {
          appUser: {},
          appUserCount: {},
          forumTopic: {
            userId: 'userId',
            deletedAt: 'deletedAt',
            sectionId: 'sectionId',
          },
          forumSection: {
            id: 'id',
            name: 'name',
            deletedAt: 'deletedAt',
          },
          growthLedgerRecord: {},
          userBadge: {},
          userBadgeAssignment: {},
          userLevelRule: {},
        },
      } as any,
      {} as any,
      { checkStatusBatch: favoritedStatusBatch } as any,
      { checkStatusBatch: likedStatusBatch } as any,
      {} as any,
    )

    const result = await service.getMyTopics(7, {
      pageIndex: 1,
      pageSize: 20,
    })

    expect(likedStatusBatch).toHaveBeenCalledWith(3, [101], 7)
    expect(favoritedStatusBatch).toHaveBeenCalledWith(3, [101], 7)
    expect(result.list).toEqual([
      expect.objectContaining({
        id: 101,
        userId: 7,
        liked: true,
        favorited: false,
        user: {
          id: 7,
          nickname: '测试作者',
          avatarUrl: 'https://example.com/avatar.png',
        },
        section: null,
      }),
    ])
  })

  it('maps profile counts with split follow fields only', async () => {
    const { UserProfileService } = await import('./profile.service')

    const findFirst = jest.fn().mockResolvedValue({
      id: 7,
      account: '100001',
      phoneNumber: null,
      emailAddress: null,
      levelId: null,
      nickname: '测试用户',
      avatarUrl: null,
      signature: null,
      bio: null,
      isEnabled: true,
      genderType: 0,
      birthDate: null,
      points: 0,
      experience: 0,
      status: 1,
      banReason: null,
      banUntil: null,
      lastLoginAt: null,
      lastLoginIp: null,
      createdAt: new Date('2026-03-29T00:00:00.000Z'),
      updatedAt: new Date('2026-03-29T00:00:00.000Z'),
      deletedAt: null,
    })

    const countWhere = jest.fn().mockResolvedValue([
      {
        userId: 7,
        commentCount: 3,
        likeCount: 5,
        favoriteCount: 2,
        followingUserCount: 8,
        followingAuthorCount: 4,
        followingSectionCount: 1,
        followersCount: 6,
        forumTopicCount: 9,
        commentReceivedLikeCount: 7,
        forumTopicReceivedLikeCount: 10,
        forumTopicReceivedFavoriteCount: 11,
      },
    ])
    const badgeOrderBy = jest.fn().mockResolvedValue([])
    const badgeWhere = jest.fn(() => ({ orderBy: badgeOrderBy }))
    const badgeInnerJoin = jest.fn(() => ({ where: badgeWhere }))

    const select = jest
      .fn()
      .mockReturnValueOnce({
        from: jest.fn(() => ({ where: countWhere })),
      })
      .mockReturnValueOnce({
        from: jest.fn(() => ({ innerJoin: badgeInnerJoin })),
      })

    const service = new UserProfileService(
      {
        db: {
          query: {
            appUser: {
              findFirst,
            },
          },
          select,
        },
        schema: {
          appUser: {},
          appUserCount: {
            userId: 'userId',
            commentCount: 'commentCount',
            likeCount: 'likeCount',
            favoriteCount: 'favoriteCount',
            followingUserCount: 'followingUserCount',
            followingAuthorCount: 'followingAuthorCount',
            followingSectionCount: 'followingSectionCount',
            followersCount: 'followersCount',
            forumTopicCount: 'forumTopicCount',
            commentReceivedLikeCount: 'commentReceivedLikeCount',
            forumTopicReceivedLikeCount: 'forumTopicReceivedLikeCount',
            forumTopicReceivedFavoriteCount: 'forumTopicReceivedFavoriteCount',
          },
          userBadgeAssignment: {
            userId: 'userId',
            badgeId: 'badgeId',
            createdAt: 'createdAt',
          },
          userBadge: {
            id: 'id',
          },
        },
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    )

    const result = await service.getProfile(7)

    expect(result.counts).toEqual({
      userId: 7,
      commentCount: 3,
      likeCount: 5,
      favoriteCount: 2,
      followingUserCount: 8,
      followingAuthorCount: 4,
      followingSectionCount: 1,
      followersCount: 6,
      forumTopicCount: 9,
      commentReceivedLikeCount: 7,
      forumTopicReceivedLikeCount: 10,
      forumTopicReceivedFavoriteCount: 11,
    })
    expect(Object.keys(result.counts).sort()).toEqual([
      'commentCount',
      'commentReceivedLikeCount',
      'favoriteCount',
      'followersCount',
      'followingAuthorCount',
      'followingSectionCount',
      'followingUserCount',
      'forumTopicCount',
      'forumTopicReceivedFavoriteCount',
      'forumTopicReceivedLikeCount',
      'likeCount',
      'userId',
    ])
  })
})
