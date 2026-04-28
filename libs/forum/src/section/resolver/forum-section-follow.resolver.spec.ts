import { ForumSectionFollowResolver } from './forum-section-follow.resolver'

describe('ForumSectionFollowResolver', () => {
  it('delegates follow target visibility checks to the unified section permission guard', async () => {
    const forumPermissionService = {
      ensureUserCanAccessSection: jest.fn().mockResolvedValue({
        id: 8,
      }),
    }

    const resolver = new ForumSectionFollowResolver(
      {
        registerResolver: jest.fn(),
      } as never,
      forumPermissionService as never,
      {} as never,
      {} as never,
    )

    await expect(resolver.ensureExists({} as never, 8, 9)).resolves.toEqual({})

    expect(forumPermissionService.ensureUserCanAccessSection).toHaveBeenCalledWith(
      8,
      9,
      {
        requireEnabled: true,
        notFoundMessage: '板块不存在',
      },
    )
  })

  it('reuses the section public list-item aggregation for follow detail hydration', async () => {
    const forumSectionService = {
      batchGetVisibleSectionListItems: jest.fn().mockResolvedValue([
        {
          id: 8,
          groupId: 2,
          userLevelRuleId: 5,
          name: '进阶讨论区',
          description: '仅高等级用户可见',
          icon: 'https://cdn.example.com/forum/section-8-icon.png',
          cover: 'https://cdn.example.com/forum/section-8-cover.png',
          sortOrder: 1,
          isEnabled: true,
          topicReviewPolicy: 1,
          topicCount: 4,
          commentCount: 12,
          followersCount: 6,
          lastPostAt: new Date('2026-04-28T08:00:00.000Z'),
          canAccess: false,
          requiredExperience: 1200,
          accessDeniedReason: '当前板块需要更高等级访问',
          isFollowed: true,
        },
      ]),
    }

    const resolver = new ForumSectionFollowResolver(
      {
        registerResolver: jest.fn(),
      } as never,
      {} as never,
      {} as never,
      forumSectionService as never,
    )

    await expect(resolver.batchGetDetails([8], 9)).resolves.toEqual(
      new Map([
        [
          8,
          expect.objectContaining({
            id: 8,
            canAccess: false,
            requiredExperience: 1200,
            accessDeniedReason: '当前板块需要更高等级访问',
            isFollowed: true,
          }),
        ],
      ]),
    )

    expect(
      forumSectionService.batchGetVisibleSectionListItems,
    ).toHaveBeenCalledWith([8], 9)
  })
})
