import { FollowTargetTypeEnum } from './follow.constant'
import { FollowService } from './follow.service'

describe('FollowService hashtag page', () => {
  it('hydrates followed hashtags from the registered resolver detail map', async () => {
    const service = new FollowService(
      {} as never,
      {} as never,
      {
        db: {},
        schema: {
          userFollow: {},
        },
        ext: {
          findPagination: jest.fn().mockResolvedValue({
            list: [
              {
                id: 1,
                targetType: FollowTargetTypeEnum.FORUM_HASHTAG,
                targetId: 77,
                userId: 9,
                createdAt: new Date('2026-04-28T00:00:00.000Z'),
              },
            ],
            total: 1,
            pageIndex: 1,
            pageSize: 10,
          }),
        },
      } as never,
    )

    service.registerResolver({
      targetType: FollowTargetTypeEnum.FORUM_HASHTAG,
      ensureExists: jest.fn(),
      applyCountDelta: jest.fn(),
      batchGetDetails: jest.fn().mockResolvedValue(
        new Map([
          [
            77,
            {
              id: 77,
              slug: 'typescript',
              displayName: 'TypeScript',
            },
          ],
        ]),
      ),
    })

    await expect(
      service.getFollowedHashtagPage({
        userId: 9,
        pageIndex: 1,
        pageSize: 10,
      }),
    ).resolves.toEqual({
      list: [
        expect.objectContaining({
          targetId: 77,
          hashtag: {
            id: 77,
            slug: 'typescript',
            displayName: 'TypeScript',
          },
        }),
      ],
      total: 1,
      pageIndex: 1,
      pageSize: 10,
    })
  })

  it('passes page userId into section detail hydration and preserves public section access fields', async () => {
    const service = new FollowService(
      {} as never,
      {} as never,
      {
        db: {},
        schema: {
          userFollow: {},
        },
        ext: {
          findPagination: jest.fn().mockResolvedValue({
            list: [
              {
                id: 2,
                targetType: FollowTargetTypeEnum.FORUM_SECTION,
                targetId: 88,
                userId: 9,
                createdAt: new Date('2026-04-28T00:00:00.000Z'),
              },
            ],
            total: 1,
            pageIndex: 1,
            pageSize: 10,
          }),
        },
      } as never,
    )

    const batchGetDetails = jest.fn().mockResolvedValue(
      new Map([
        [
          88,
          {
            id: 88,
            groupId: 3,
            userLevelRuleId: 5,
            name: '进阶讨论区',
            description: '仅高等级用户可见',
            icon: 'https://cdn.example.com/forum/section-88-icon.png',
            cover: 'https://cdn.example.com/forum/section-88-cover.png',
            sortOrder: 1,
            isEnabled: true,
            topicReviewPolicy: 1,
            topicCount: 8,
            commentCount: 20,
            followersCount: 16,
            lastPostAt: new Date('2026-04-28T08:00:00.000Z'),
            isFollowed: false,
            canAccess: false,
            requiredExperience: 1200,
            accessDeniedReason: '当前板块需要更高等级访问',
          },
        ],
      ]),
    )

    service.registerResolver({
      targetType: FollowTargetTypeEnum.FORUM_SECTION,
      ensureExists: jest.fn(),
      applyCountDelta: jest.fn(),
      batchGetDetails,
    })

    await expect(
      service.getFollowedSectionPage({
        userId: 9,
        pageIndex: 1,
        pageSize: 10,
      }),
    ).resolves.toEqual({
      list: [
        expect.objectContaining({
          targetId: 88,
          section: expect.objectContaining({
            id: 88,
            canAccess: false,
            requiredExperience: 1200,
            accessDeniedReason: '当前板块需要更高等级访问',
            isFollowed: true,
          }),
        }),
      ],
      total: 1,
      pageIndex: 1,
      pageSize: 10,
    })

    expect(batchGetDetails).toHaveBeenCalledWith([88], 9)
  })
})
