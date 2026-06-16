/// <reference types="jest" />

jest.mock('@libs/content/work/content/comic-content.service', () => ({
  ComicContentService: class {},
}))
jest.mock('@libs/content/work/content/novel-content.service', () => ({
  NovelContentService: class {},
}))

import { WorkCategoryController } from './work-category.controller'
import { WorkChapterController } from './work-chapter.controller'
import { WorkController } from './work.controller'
import { WorkTagController } from './work-tag.controller'

describe('app work catalog controllers', () => {
  it('queries only enabled work categories for the public app catalog', async () => {
    const categoryService = {
      getAppCategoryPage: jest.fn(async () => ({
        list: [],
        total: 0,
        pageIndex: 2,
        pageSize: 20,
      })),
    }
    const controller = new WorkCategoryController(categoryService as any)

    await controller.getCategoryPage({
      contentType: '[1]',
      pageIndex: 2,
      pageSize: 20,
    } as any)

    expect(categoryService.getAppCategoryPage).toHaveBeenCalledWith({
      contentType: '[1]',
      pageIndex: 2,
      pageSize: 20,
    })
  })

  it('queries only enabled work tags for the public app catalog', async () => {
    const tagService = {
      getAppTagPage: jest.fn(async () => ({
        list: [],
        total: 0,
        pageIndex: 2,
        pageSize: 20,
      })),
    }
    const controller = new WorkTagController(tagService as any)

    await controller.getTagPage({
      name: '热血',
      pageIndex: 2,
      pageSize: 20,
    } as any)

    expect(tagService.getAppTagPage).toHaveBeenCalledWith({
      name: '热血',
      pageIndex: 2,
      pageSize: 20,
    })
  })

  it('forwards full PageDto fields to work comments', async () => {
    const workService = {
      getWorkCommentTarget: jest.fn(async () => ({
        targetType: 'work',
        targetId: 31,
      })),
    }
    const commentService = {
      getTargetComments: jest.fn(async (_query: unknown) => ({
        list: [],
        total: 0,
        pageIndex: 3,
        pageSize: 15,
      })),
    }
    const controller = new WorkController(
      workService as any,
      commentService as any,
    )

    await controller.getWorkCommentPage(
      {
        id: 31,
        pageIndex: 3,
        pageSize: 15,
        orderBy: 'createdAt:desc',
        startDate: '2026-03-01',
        endDate: '2026-03-31',
      } as any,
      12,
    )

    expect(workService.getWorkCommentTarget).toHaveBeenCalledWith(31)
    expect(commentService.getTargetComments).toHaveBeenCalledWith({
      pageIndex: 3,
      pageSize: 15,
      orderBy: 'createdAt:desc',
      startDate: '2026-03-01',
      endDate: '2026-03-31',
      targetType: 'work',
      targetId: 31,
      previewReplyLimit: 3,
      userId: 12,
    })
    expect(
      commentService.getTargetComments.mock.calls[0][0],
    ).not.toHaveProperty('id')
  })

  it('forwards full PageDto fields to work chapter comments', async () => {
    const workChapterService = {
      getChapterCommentTarget: jest.fn(async () => ({
        targetType: 'chapter',
        targetId: 42,
      })),
    }
    const commentService = {
      getTargetComments: jest.fn(async (_query: unknown) => ({
        list: [],
        total: 0,
        pageIndex: 4,
        pageSize: 16,
      })),
    }
    const controller = new WorkChapterController(
      workChapterService as any,
      {} as any,
      {} as any,
      commentService as any,
    )

    await controller.getWorkChapterCommentPage(
      {
        id: 42,
        pageIndex: 4,
        pageSize: 16,
        orderBy: 'likeCount:desc',
        startDate: '2026-04-01',
        endDate: '2026-04-30',
      } as any,
      13,
    )

    expect(workChapterService.getChapterCommentTarget).toHaveBeenCalledWith(42)
    expect(commentService.getTargetComments).toHaveBeenCalledWith({
      pageIndex: 4,
      pageSize: 16,
      orderBy: 'likeCount:desc',
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      targetType: 'chapter',
      targetId: 42,
      previewReplyLimit: 3,
      userId: 13,
    })
    expect(
      commentService.getTargetComments.mock.calls[0][0],
    ).not.toHaveProperty('id')
  })
})
