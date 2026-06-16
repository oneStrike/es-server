/// <reference types="jest" />

import { ForumSearchSortTypeEnum, ForumSearchTypeEnum } from './search.constant'
import { ForumSearchService } from './search.service'

function buildService() {
  return new (ForumSearchService as any)(
    {
      buildPage: jest.fn(() => ({
        limit: 10,
        offset: 0,
        pageIndex: 1,
        pageSize: 10,
      })),
      buildPageParams: jest.fn(() => ({
        page: {
          limit: 10,
          offset: 0,
          pageIndex: 1,
          pageSize: 10,
        },
        order: {
          orderBySql: [],
        },
        dateRange: undefined,
      })),
      db: {},
      schema: {},
    },
    {},
  ) as any
}

function buildSearchResult(
  overrides: Partial<{
    resultType: ForumSearchTypeEnum
    topicId: number
    commentId: number | null
    createdAt: Date
    commentCount: number
    likeCount: number
    favoriteCount: number
    viewCount: number
  }> = {},
) {
  return {
    resultType: overrides.resultType ?? ForumSearchTypeEnum.TOPIC,
    topicId: overrides.topicId ?? 100,
    topicTitle: '测试主题',
    topicContentSnippet: '测试内容',
    sectionId: 1,
    sectionName: '综合',
    userId: 33,
    userNickname: '用户',
    userAvatarUrl: null,
    commentId: overrides.commentId ?? null,
    commentContentSnippet: null,
    createdAt: overrides.createdAt ?? new Date('2026-06-01T00:00:00.000Z'),
    commentCount: overrides.commentCount ?? 1,
    viewCount: overrides.viewCount ?? 1,
    likeCount: overrides.likeCount ?? 1,
    favoriteCount: overrides.favoriteCount ?? 1,
  }
}

describe('ForumSearchService public page contract', () => {
  it('orders mixed search by createdAt, result type, comment id, and topic id', () => {
    const service = buildService()
    const createdAt = new Date('2026-06-01T00:00:00.000Z')
    const results = [
      buildSearchResult({
        resultType: ForumSearchTypeEnum.TOPIC,
        topicId: 20,
        createdAt,
      }),
      buildSearchResult({
        resultType: ForumSearchTypeEnum.COMMENT,
        topicId: 10,
        commentId: 101,
        createdAt,
      }),
      buildSearchResult({
        resultType: ForumSearchTypeEnum.COMMENT,
        topicId: 11,
        commentId: 102,
        createdAt,
      }),
    ]

    results.sort((left, right) =>
      service.compareResults(left, right, ForumSearchSortTypeEnum.RELEVANCE),
    )

    expect(
      results.map((item) => [item.resultType, item.commentId, item.topicId]),
    ).toEqual([
      [ForumSearchTypeEnum.COMMENT, 102, 11],
      [ForumSearchTypeEnum.COMMENT, 101, 10],
      [ForumSearchTypeEnum.TOPIC, null, 20],
    ])
  })

  it('delegates public search to the standard page contract', async () => {
    const service = buildService()
    const pageResult = {
      list: [buildSearchResult()],
      total: 1,
      pageIndex: 2,
      pageSize: 5,
    }
    const searchInternal = jest
      .spyOn(service, 'searchInternal')
      .mockResolvedValue(pageResult)

    const result = await service.searchPublic(
      {
        keyword: '测试',
        pageIndex: 2,
        pageSize: 5,
      },
      10,
    )

    expect(searchInternal).toHaveBeenCalledWith(
      {
        keyword: '测试',
        pageIndex: 2,
        pageSize: 5,
      },
      { publicOnly: true, userId: 10 },
    )
    expect(result).toEqual(pageResult)
    expect(result).not.toHaveProperty('hasMore')
    expect(result).not.toHaveProperty('nextCursor')
  })

  it('rejects ambiguous sort and orderBy protocol', async () => {
    const service = buildService()

    await expect(
      service.searchPublic(
        {
          keyword: '测试',
          orderBy: '{"createdAt":"desc"}',
          pageIndex: 1,
          pageSize: 5,
          sort: ForumSearchSortTypeEnum.HOT,
        } as any,
        10,
      ),
    ).rejects.toThrow('sort 和 orderBy')
  })

  it('orders mixed search by explicit orderBy fields', () => {
    const service = buildService()
    const results = [
      buildSearchResult({
        resultType: ForumSearchTypeEnum.TOPIC,
        topicId: 20,
        likeCount: 1,
      }),
      buildSearchResult({
        resultType: ForumSearchTypeEnum.COMMENT,
        topicId: 10,
        commentId: 101,
        likeCount: 5,
      }),
      buildSearchResult({
        resultType: ForumSearchTypeEnum.TOPIC,
        topicId: 30,
        likeCount: 3,
      }),
    ]

    results.sort((left, right) =>
      service.compareResultsByOrderBy(left, right, {
        likeCount: 'desc',
      }),
    )

    expect(results.map((item) => item.likeCount)).toEqual([5, 3, 1])
  })
})
