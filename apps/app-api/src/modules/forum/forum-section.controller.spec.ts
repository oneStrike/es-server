import { ForumSectionController } from './forum-section.controller'

describe('ForumSectionController', () => {
  it('uses only current user context when resolving public detail access state', async () => {
    const forumSectionService = {
      getVisibleSectionDetail: jest.fn().mockResolvedValue({ id: 3 }),
    }
    const controller = new ForumSectionController(
      forumSectionService as never,
    )

    await expect(
      controller.getDetail({ id: 3 } as never, 9),
    ).resolves.toEqual({ id: 3 })

    expect(forumSectionService.getVisibleSectionDetail).toHaveBeenCalledWith(
      3,
      9,
    )
  })

  it('ignores injected query userId when the request is anonymous', async () => {
    const forumSectionService = {
      getVisibleSectionDetail: jest.fn().mockResolvedValue({ id: 3 }),
    }
    const controller = new ForumSectionController(
      forumSectionService as never,
    )

    await controller.getDetail({ id: 3, userId: 88 } as never, undefined)

    expect(forumSectionService.getVisibleSectionDetail).toHaveBeenCalledWith(
      3,
      undefined,
    )
  })
})
