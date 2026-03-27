import { forumSection, forumSectionGroup } from '@db/schema'
import { asc } from 'drizzle-orm'

jest.mock('@db/core', () => ({
  DrizzleService: class {},
  escapeLikePattern: (value: string) => value,
}))

jest.mock('@libs/interaction/follow', () => ({
  FollowService: class {},
  FollowTargetTypeEnum: {},
}))

jest.mock('../counter', () => ({
  ForumCounterService: class {},
}))

jest.mock('../permission', () => ({
  ForumPermissionService: class {},
}))

describe('forum section service', () => {
  it('uses groupId as the swap scope when reordering sections', async () => {
    const { ForumSectionService } = await import('./forum-section.service')
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
    const { ForumSectionService } = await import('./forum-section.service')
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
    const { ForumSectionService } = await import('./forum-section.service')
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
})
