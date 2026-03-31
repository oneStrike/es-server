import { forumSectionGroup } from '@db/schema'

jest.mock('@db/core', () => ({
  DrizzleService: class {},
  escapeLikePattern: (value: string) => value,
}))

jest.mock('@libs/interaction/follow', () => ({
  FollowService: class {},
  FollowTargetTypeEnum: {},
}))

jest.mock('../../permission', () => ({
  ForumPermissionService: class {},
}))

function createEmptyPage() {
  return {
    list: [],
    total: 0,
    pageIndex: 1,
    pageSize: 20,
    totalPage: 0,
  }
}

describe('forum section group service sort order', () => {
  it('uses sortOrder asc for section group pagination when orderBy is blank', async () => {
    const { ForumSectionGroupService } = await import('../forum-section-group.service')
    const findPagination = jest.fn().mockResolvedValue(createEmptyPage())
    const service = new ForumSectionGroupService(
      {
        ext: { findPagination },
        schema: { forumSectionGroup },
      } as any,
      {} as any,
      {} as any,
    )

    await service.getSectionGroupPage({ orderBy: '   ' } as any)

    expect(findPagination).toHaveBeenCalledWith(
      forumSectionGroup,
      expect.objectContaining({
        orderBy: { sortOrder: 'asc' },
      }),
    )
  })
})
