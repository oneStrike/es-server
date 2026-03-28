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
})
