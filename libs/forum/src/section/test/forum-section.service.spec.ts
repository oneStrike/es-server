import { forumSection, forumSectionGroup } from '@db/schema'
import { asc } from 'drizzle-orm'

jest.mock('@db/core', () => ({
  DrizzleService: class {},
  escapeLikePattern: (value: string) => value,
}))

jest.mock('@libs/interaction/follow', () => ({
  FollowService: class {},
  FollowTargetTypeEnum: {
    FORUM_SECTION: 'FORUM_SECTION',
  },
}))

jest.mock('../../counter', () => ({
  ForumCounterService: class {},
}))

jest.mock('../../permission', () => ({
  ForumPermissionService: class {},
}))

describe('forum section service', () => {
  it('uses groupId as the swap scope when reordering sections', async () => {
    const { ForumSectionService } = await import('../forum-section.service')
    const swapField = jest.fn().mockResolvedValue(true)
    const service = new ForumSectionService(
      {
        ext: { swapField },
        schema: { forumSection: { __table: 'forumSection' } },
      } as any,
      {} as any,
      {} as any,
      {} as any,
    )

    await expect(
      service.updateSectionSort({ dragId: 11, targetId: 22 }),
    ).resolves.toBe(true)

    expect(swapField).toHaveBeenCalledWith(
      service.forumSection,
      expect.objectContaining({
        where: [{ id: 11 }, { id: 22 }],
        sourceField: 'groupId',
      }),
    )
  })

  it('uses sortOrder asc for section pagination when orderBy is blank', async () => {
    const { ForumSectionService } = await import('../forum-section.service')
    const findPagination = jest.fn().mockResolvedValue({
      list: [],
      total: 0,
      pageIndex: 1,
      pageSize: 20,
      totalPage: 0,
    })
    const service = new ForumSectionService(
      {
        ext: { findPagination },
        schema: { forumSection },
      } as any,
      {} as any,
      {} as any,
      {} as any,
    )

    await service.getSectionPage({ orderBy: '   ' } as any)

    expect(findPagination).toHaveBeenCalledWith(
      forumSection,
      expect.objectContaining({
        orderBy: { sortOrder: 'asc' },
      }),
    )
  })

  it('adds id as the stable tiebreaker for section tree ordering', async () => {
    const { ForumSectionService } = await import('../forum-section.service')
    const findMany = jest.fn().mockResolvedValue([])
    const service = new ForumSectionService(
      {
        db: {
          query: {
            forumSectionGroup: { findMany },
          },
        },
        schema: { forumSectionGroup },
      } as any,
      {} as any,
      {} as any,
      {} as any,
    )

    await service.getSectionTree()

    const options = findMany.mock.calls[0][0]
    const orderBy = options.orderBy(forumSectionGroup, { asc })

    expect(orderBy).toHaveLength(2)
  })

  it('returns workId and follow status for visible section detail', async () => {
    const { ForumSectionService } = await import('../forum-section.service')
    const lastPostAt = new Date('2024-01-01T00:00:00.000Z')
    const findFirst = jest.fn().mockResolvedValue({
      id: 12,
      groupId: 3,
      userLevelRuleId: null,
      name: '作品讨论',
      description: '讨论专区',
      icon: 'https://example.com/icon.png',
      cover: 'https://example.com/cover.png',
      sortOrder: 1,
      isEnabled: true,
      topicReviewPolicy: 1,
      topicCount: 10,
      commentCount: 20,
      followersCount: 30,
      lastPostAt,
      group: {
        id: 3,
        name: '作品分组',
        description: '分组描述',
        sortOrder: 2,
        isEnabled: true,
        deletedAt: null,
      },
      work: {
        id: 88,
      },
    })
    const getSectionAccessStateMap = jest.fn().mockResolvedValue(
      new Map([
        [
          12,
          {
            canAccess: true,
            requiredExperience: null,
          },
        ],
      ]),
    )
    const checkFollowStatus = jest.fn().mockResolvedValue({
      isFollowing: true,
      isFollowedByTarget: false,
      isMutualFollow: false,
    })
    const service = new ForumSectionService(
      {
        db: {
          query: {
            forumSection: { findFirst },
          },
        },
        schema: { forumSection },
      } as any,
      { getSectionAccessStateMap } as any,
      { checkFollowStatus } as any,
      {} as any,
    )

    const result = await service.getVisibleSectionDetail(12, 99)

    expect(result).toMatchObject({
      id: 12,
      workId: 88,
      isFollowed: true,
      group: {
        id: 3,
        name: '作品分组',
      },
    })
    expect(checkFollowStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        targetId: 12,
        userId: 99,
      }),
    )
  })
})
