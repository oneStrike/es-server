import { workChapter } from '@db/schema'

jest.mock('@db/core', () => ({
  buildILikeCondition: jest.fn((_column: unknown, value?: string) =>
    value ? { type: 'ilike', value } : undefined,
  ),
  buildLikePattern: jest.fn((value?: string) =>
    value?.trim() ? `%${value.trim()}%` : undefined,
  ),
  DrizzleService: class {},
  escapeLikePattern: (value: string) => value,
}))

jest.mock('@libs/interaction/browse-log/browse-log.service', () => ({
  BrowseLogService: class {}
}))

jest.mock('@libs/interaction/browse-log/browse-log.constant', () => ({
  BrowseLogTargetTypeEnum: {}
}))

jest.mock('@libs/interaction/comment/comment.constant', () => ({
  CommentTargetTypeEnum: {}
}))

jest.mock('@libs/interaction/download/download.service', () => ({
  DownloadService: class {}
}))

jest.mock('@libs/interaction/download/download.constant', () => ({
  DownloadTargetTypeEnum: {}
}))

jest.mock('@libs/interaction/favorite/favorite.service', () => ({
  FavoriteService: class {}
}))

jest.mock('@libs/interaction/like/like.service', () => ({
  LikeService: class {}
}))

jest.mock('@libs/interaction/like/like.constant', () => ({
  LikeTargetTypeEnum: {}
}))

jest.mock('@libs/interaction/reading-state/reading-state.service', () => ({
  ReadingStateService: class {}
}))

jest.mock('@libs/platform/constant/content.constant', () => ({
  ContentTypeEnum: {}
}))

jest.mock('../../../permission/content-permission.service', () => ({
  ContentPermissionService: class {}
}))

describe('work chapter service', () => {
  it('uses sortOrder asc for chapter pagination when orderBy is blank', async () => {
    const { WorkChapterService } = await import('../work-chapter.service')
    const findPagination = jest.fn().mockResolvedValue({
      list: [],
      total: 0,
      pageIndex: 1,
      pageSize: 20,
      totalPage: 0,
    })
    const service = new WorkChapterService(
      {
        ext: { findPagination },
        schema: { workChapter },
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    )

    await service.getChapterPage({ workId: 1, orderBy: '   ' })

    expect(findPagination).toHaveBeenCalledWith(
      workChapter,
      expect.objectContaining({
        orderBy: { sortOrder: 'asc' },
      }),
    )
  })
})
