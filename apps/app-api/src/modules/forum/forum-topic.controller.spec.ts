/// <reference types="jest" />

jest.mock('@libs/platform/modules/geo/geo.service', () => ({
  GeoService: class {},
}))

import { ForumTopicController } from './forum-topic.controller'

describe('App ForumTopicController pagination contract', () => {
  it('forwards full PageDto fields to forum topic comments', async () => {
    const forumTopicService = {
      getTopicCommentTarget: jest.fn(async () => ({
        targetType: 'forum_topic',
        targetId: 11,
      })),
    }
    const commentService = {
      getTargetComments: jest.fn(async (_query: unknown) => ({
        list: [],
        total: 0,
        pageIndex: 2,
        pageSize: 10,
      })),
    }
    const controller = new ForumTopicController(
      forumTopicService as any,
      {} as any,
      commentService as any,
      {} as any,
    )

    await controller.getTopicCommentPage(
      {
        id: 11,
        pageIndex: 2,
        pageSize: 10,
        orderBy: 'createdAt:desc',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        onlyAuthor: true,
      } as any,
      7,
    )

    expect(forumTopicService.getTopicCommentTarget).toHaveBeenCalledWith(11, 7)
    expect(commentService.getTargetComments).toHaveBeenCalledWith({
      pageIndex: 2,
      pageSize: 10,
      orderBy: 'createdAt:desc',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      onlyAuthor: true,
      targetType: 'forum_topic',
      targetId: 11,
      userId: 7,
    })
    expect(
      commentService.getTargetComments.mock.calls[0][0],
    ).not.toHaveProperty('id')
  })
})
