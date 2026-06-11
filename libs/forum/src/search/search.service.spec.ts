/// <reference types="jest" />

import { BadRequestException } from '@nestjs/common'
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

function buildFingerprint(
  service: any,
  overrides: Partial<{
    keyword: string
    type: ForumSearchTypeEnum
    sectionId: number | null
    hashtagId: number | null
    sort: ForumSearchSortTypeEnum
    userId: number
  }> = {},
) {
  return service.buildSearchQueryFingerprint(
    {
      keyword: overrides.keyword ?? ' 测试 ',
      type: overrides.type ?? ForumSearchTypeEnum.ALL,
      sectionId: overrides.sectionId ?? 1,
      hashtagId: overrides.hashtagId ?? 2,
      sort: overrides.sort ?? ForumSearchSortTypeEnum.RELEVANCE,
    },
    overrides.userId,
  )
}

describe('ForumSearchService public cursor contract', () => {
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

    expect(results.map((item) => [item.resultType, item.commentId, item.topicId]))
      .toEqual([
        [ForumSearchTypeEnum.COMMENT, 102, 11],
        [ForumSearchTypeEnum.COMMENT, 101, 10],
        [ForumSearchTypeEnum.TOPIC, null, 20],
      ])
  })

  it('encodes and validates destructive mixed-search cursor fields', () => {
    const service = buildService()
    const queryFingerprint = buildFingerprint(service, {
      sort: ForumSearchSortTypeEnum.HOT,
    })
    const cursor = service.encodeSearchCursor(
      buildSearchResult({
        resultType: ForumSearchTypeEnum.COMMENT,
        topicId: 10,
        commentId: 101,
      }),
      ForumSearchSortTypeEnum.HOT,
      queryFingerprint,
    )
    const decoded = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    )

    expect(decoded).toMatchObject({
      sort: ForumSearchSortTypeEnum.HOT,
      queryFingerprint: {
        keyword: '测试',
        type: ForumSearchTypeEnum.ALL,
        sectionId: 1,
        hashtagId: 2,
        sort: ForumSearchSortTypeEnum.HOT,
        viewerScope: 'guest',
      },
      resultTypeRank: 1,
      commentIdForSort: 101,
      topicId: 10,
      commentId: 101,
    })
    expect(service.parseSearchCursor(cursor)).toMatchObject({
      sort: ForumSearchSortTypeEnum.HOT,
      queryFingerprint: {
        keyword: '测试',
        type: ForumSearchTypeEnum.ALL,
        sectionId: 1,
        hashtagId: 2,
        sort: ForumSearchSortTypeEnum.HOT,
        viewerScope: 'guest',
      },
      resultTypeRank: 1,
      commentIdForSort: 101,
      topicId: 10,
      commentId: 101,
    })
  })

  it('rejects old or inconsistent public search cursors', () => {
    const service = buildService()
    const oldCursor = Buffer.from(
      JSON.stringify({
        sort: ForumSearchSortTypeEnum.RELEVANCE,
        hotScore: 1,
        createdAt: '2026-06-01T00:00:00.000Z',
        topicId: 10,
        commentId: null,
      }),
    ).toString('base64url')
    const inconsistentCursor = Buffer.from(
      JSON.stringify({
        sort: ForumSearchSortTypeEnum.RELEVANCE,
        queryFingerprint: buildFingerprint(service),
        hotScore: 1,
        createdAt: '2026-06-01T00:00:00.000Z',
        resultTypeRank: 1,
        commentIdForSort: 102,
        topicId: 10,
        commentId: 101,
      }),
    ).toString('base64url')

    expect(() => service.parseSearchCursor(oldCursor)).toThrow(
      BadRequestException,
    )
    expect(() => service.parseSearchCursor(inconsistentCursor)).toThrow(
      BadRequestException,
    )
  })

  it('rejects public search cursor when sort changes between pages', async () => {
    const service = buildService()
    const queryFingerprint = buildFingerprint(service, {
      sort: ForumSearchSortTypeEnum.HOT,
    })
    const cursor = service.encodeSearchCursor(
      buildSearchResult(),
      ForumSearchSortTypeEnum.HOT,
      queryFingerprint,
    )

    await expect(
      service.searchPublic({
        keyword: '测试',
        pageSize: 10,
        sort: ForumSearchSortTypeEnum.RELEVANCE,
        cursor,
      }),
    ).rejects.toThrow('搜索条件不匹配')
  })

  it.each([
    ['keyword', { keyword: '别的' }],
    ['type', { type: ForumSearchTypeEnum.TOPIC }],
    ['sectionId', { sectionId: 9 }],
    ['hashtagId', { hashtagId: 8 }],
    ['sort', { sort: ForumSearchSortTypeEnum.HOT }],
    ['viewerScope', { userId: 10 }],
  ])(
    'rejects public search cursor when normalized %s changes',
    async (_field, overrides) => {
      const service = buildService()
      const { userId, ...queryOverrides } = overrides as typeof overrides & {
        userId?: number
      }
      const cursor = service.encodeSearchCursor(
        buildSearchResult(),
        ForumSearchSortTypeEnum.RELEVANCE,
        buildFingerprint(service),
      )

      await expect(
        service.searchPublic({
          keyword: '测试',
          type: ForumSearchTypeEnum.ALL,
          sectionId: 1,
          hashtagId: 2,
          sort: ForumSearchSortTypeEnum.RELEVANCE,
          pageSize: 10,
          cursor,
          ...queryOverrides,
        }, userId),
      ).rejects.toThrow('搜索条件不匹配')
    },
  )

  it('rejects public search cursor when viewer changes from user to guest', async () => {
    const service = buildService()
    const cursor = service.encodeSearchCursor(
      buildSearchResult(),
      ForumSearchSortTypeEnum.RELEVANCE,
      buildFingerprint(service, { userId: 10 }),
    )

    await expect(
      service.searchPublic({
        keyword: '测试',
        type: ForumSearchTypeEnum.ALL,
        sectionId: 1,
        hashtagId: 2,
        sort: ForumSearchSortTypeEnum.RELEVANCE,
        pageSize: 10,
        cursor,
      }),
    ).rejects.toThrow('搜索条件不匹配')
  })

  it('normalizes forum search query fingerprint values', () => {
    const service = buildService()

    expect(
      service.buildSearchQueryFingerprint({
        keyword: '  TeSt  ',
      }),
    ).toEqual({
      keyword: 'test',
      type: ForumSearchTypeEnum.ALL,
      sectionId: null,
      hashtagId: null,
      sort: ForumSearchSortTypeEnum.RELEVANCE,
      viewerScope: 'guest',
    })
  })
})
