import { workChapter } from '@db/schema'

jest.mock('@db/core', () => ({
  DrizzleService: class {},
  escapeLikePattern: (value: string) => value,
}))

jest.mock('@libs/interaction/browse-log', () => ({
  BrowseLogService: class {},
  BrowseLogTargetTypeEnum: {},
}))

jest.mock('@libs/interaction/comment', () => ({
  CommentTargetTypeEnum: {},
}))

jest.mock('@libs/interaction/download', () => ({
  DownloadService: class {},
  DownloadTargetTypeEnum: {},
}))

jest.mock('@libs/interaction/favorite', () => ({
  FavoriteService: class {},
}))

jest.mock('@libs/interaction/like', () => ({
  LikeService: class {},
  LikeTargetTypeEnum: {},
}))

jest.mock('@libs/interaction/reading-state', () => ({
  ReadingStateService: class {},
}))

jest.mock('@libs/platform/constant', () => ({
  ContentTypeEnum: {},
}))

jest.mock('../../../permission', () => ({
  ContentPermissionService: class {},
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
