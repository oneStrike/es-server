/// <reference types="jest" />

import { WorkCategoryController } from './work-category.controller'
import { WorkTagController } from './work-tag.controller'

describe('app work catalog controllers', () => {
  it('queries only enabled work categories for the public app catalog', async () => {
    const categoryService = {
      getAppCategoryCursorPage: jest.fn(async () => ({
        list: [],
        pageSize: 20,
        hasMore: false,
        nextCursor: null,
      })),
    }
    const controller = new WorkCategoryController(categoryService as any)

    await controller.getCategoryPage({
      contentType: '[1]',
      cursor: 'cursor-1',
      pageSize: 20,
    } as any)

    expect(categoryService.getAppCategoryCursorPage).toHaveBeenCalledWith({
        contentType: '[1]',
        cursor: 'cursor-1',
        pageSize: 20,
    })
  })

  it('queries only enabled work tags for the public app catalog', async () => {
    const tagService = {
      getAppTagCursorPage: jest.fn(async () => ({
        list: [],
        pageSize: 20,
        hasMore: false,
        nextCursor: null,
      })),
    }
    const controller = new WorkTagController(tagService as any)

    await controller.getTagPage({
      name: '热血',
      cursor: 'cursor-1',
      pageSize: 20,
    } as any)

    expect(tagService.getAppTagCursorPage).toHaveBeenCalledWith({
        name: '热血',
        cursor: 'cursor-1',
        pageSize: 20,
    })
  })
})
