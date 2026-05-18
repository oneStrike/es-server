/// <reference types="jest" />

import { WorkCategoryController } from './work-category.controller'
import { WorkTagController } from './work-tag.controller'

describe('app work catalog controllers', () => {
  it('queries only enabled work categories for the public app catalog', async () => {
    const categoryService = {
      getCategoryPage: jest.fn(async () => ({ list: [], total: 0 })),
    }
    const controller = new WorkCategoryController(categoryService as any)

    await controller.getCategoryPage({
      contentType: '[1]',
      pageIndex: 1,
      pageSize: 20,
    } as any)

    expect(categoryService.getCategoryPage).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: '[1]',
        isEnabled: true,
        pageIndex: 1,
        pageSize: 20,
      }),
    )
  })

  it('queries only enabled work tags for the public app catalog', async () => {
    const tagService = {
      getTagPage: jest.fn(async () => ({ list: [], total: 0 })),
    }
    const controller = new WorkTagController(tagService as any)

    await controller.getTagPage({
      name: '热血',
      pageIndex: 1,
      pageSize: 20,
    } as any)

    expect(tagService.getTagPage).toHaveBeenCalledWith(
      expect.objectContaining({
        isEnabled: true,
        name: '热血',
        pageIndex: 1,
        pageSize: 20,
      }),
    )
  })
})
