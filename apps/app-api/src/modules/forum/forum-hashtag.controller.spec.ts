/// <reference types="jest" />

import { ForumHashtagController } from './forum-hashtag.controller'

describe('App ForumHashtagController pagination contract', () => {
  it('forwards full PageDto fields to hot hashtag pagination', async () => {
    const forumHashtagService = {
      getHotHashtagPage: jest.fn(async (_query: unknown) => ({
        list: [],
        total: 0,
        pageIndex: 3,
        pageSize: 8,
      })),
    }
    const controller = new ForumHashtagController(forumHashtagService as any)

    await controller.getHotPage(
      {
        pageIndex: 3,
        pageSize: 8,
        orderBy: 'lastReferencedAt:desc',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      } as any,
      5,
    )

    expect(forumHashtagService.getHotHashtagPage).toHaveBeenCalledWith({
      pageIndex: 3,
      pageSize: 8,
      orderBy: 'lastReferencedAt:desc',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      userId: 5,
    })
  })

  it('forwards full PageDto fields to linked hashtag pages without leaking id', async () => {
    const forumHashtagService = {
      getHashtagTopicPage: jest.fn(async (_id: number, _query: unknown) => ({
        list: [],
        total: 0,
        pageIndex: 4,
        pageSize: 12,
      })),
      getHashtagCommentPage: jest.fn(async (_id: number, _query: unknown) => ({
        list: [],
        total: 0,
        pageIndex: 4,
        pageSize: 12,
      })),
    }
    const controller = new ForumHashtagController(forumHashtagService as any)
    const query = {
      id: 9,
      pageIndex: 4,
      pageSize: 12,
      orderBy: 'referencedAt:desc',
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    }

    await controller.getTopicPage(query as any, 6)
    await controller.getCommentPage(query as any, 6)

    const expectedPageQuery = {
      pageIndex: 4,
      pageSize: 12,
      orderBy: 'referencedAt:desc',
      startDate: '2026-02-01',
      endDate: '2026-02-28',
      userId: 6,
    }
    expect(forumHashtagService.getHashtagTopicPage).toHaveBeenCalledWith(
      9,
      expectedPageQuery,
    )
    expect(forumHashtagService.getHashtagCommentPage).toHaveBeenCalledWith(
      9,
      expectedPageQuery,
    )
    expect(
      forumHashtagService.getHashtagTopicPage.mock.calls[0][1],
    ).not.toHaveProperty('id')
    expect(
      forumHashtagService.getHashtagCommentPage.mock.calls[0][1],
    ).not.toHaveProperty('id')
  })
})
