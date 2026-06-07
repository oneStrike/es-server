/// <reference types="jest" />

import { ContentTagController } from './tag.controller'

describe('ContentTagController', () => {
  it('uses admin tag projections for list and detail responses', async () => {
    const tagService = {
      getAdminTagDetail: jest.fn(async () => ({ id: 1, name: '热血' })),
      getAdminTagPage: jest.fn(async () => ({ list: [], total: 0 })),
    }
    const controller = new ContentTagController(tagService as any)

    await controller.getPage({ name: '热血', pageIndex: 1, pageSize: 20 } as any)
    await controller.getDetail({ id: 1 })

    expect(tagService.getAdminTagPage).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '热血',
        pageIndex: 1,
        pageSize: 20,
      }),
    )
    expect(tagService.getAdminTagDetail).toHaveBeenCalledWith({ id: 1 })
  })
})
