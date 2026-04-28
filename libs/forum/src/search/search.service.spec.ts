import { ForumHashtagReferenceSourceTypeEnum } from '../hashtag/forum-hashtag.constant'
import { ForumSearchService } from './search.service'
import { ForumSearchTypeEnum } from './search.constant'

type ForumSearchServicePrivateApi = {
  getSourceIdsByHashtag: (
    hashtagId: number,
    sourceType: ForumHashtagReferenceSourceTypeEnum,
    options: {
      publicOnly: boolean
    },
  ) => Promise<number[]>
  searchTopics: (
    dto: {
      keyword: string
      hashtagId?: number
      tagId?: number
      pageIndex: number
      pageSize: number
    },
    options: {
      publicOnly: boolean
      userId?: number
    },
  ) => Promise<{
    list: unknown[]
    total: number
    pageIndex: number
    pageSize: number
  }>
  searchComments: (
    dto: {
      keyword: string
      hashtagId?: number
      tagId?: number
      pageIndex: number
      pageSize: number
    },
    options: {
      publicOnly: boolean
      userId?: number
    },
  ) => Promise<{
    list: unknown[]
    total: number
    pageIndex: number
    pageSize: number
  }>
}

type ForumSearchServiceTestStubs = {
  resolveSectionScope: (
    sectionId: number | undefined,
    options: {
      publicOnly: boolean
      userId?: number
    },
  ) => Promise<number[] | undefined>
  getSourceIdsByHashtag: ForumSearchServicePrivateApi['getSourceIdsByHashtag']
  resolveHashtagFilterId: (dto: {
    hashtagId?: number
    tagId?: number
  }) => number | undefined
  mapCommentResults: (rows: unknown[], keyword: string) => Promise<unknown[]>
}

function createRowsQuery(rows: unknown[]) {
  return {
    from: jest.fn(() => ({
      innerJoin: jest.fn(() => ({
        where: jest.fn(() => ({
          orderBy: jest.fn(() => ({
            limit: jest.fn(() => ({
              offset: jest.fn().mockResolvedValue(rows),
            })),
          })),
        })),
      })),
    })),
  }
}

function createTotalQuery(rows: unknown[]) {
  return {
    from: jest.fn(() => ({
      innerJoin: jest.fn(() => ({
        where: jest.fn().mockResolvedValue(rows),
      })),
    })),
  }
}

describe('ForumSearchService hashtag lookup', () => {
  it('enforces public section visibility when resolving an explicit search section scope', async () => {
    const forumPermissionService = {
      ensureUserCanAccessSection: jest.fn().mockResolvedValue(undefined),
      getAccessibleSectionIds: jest.fn(),
    }
    const service = new ForumSearchService(
      {
        db: {},
        schema: {},
      } as never,
      forumPermissionService as never,
    )

    await expect(
      (service as unknown as ForumSearchServiceTestStubs).resolveSectionScope(
        5,
        {
          publicOnly: true,
          userId: 9,
        },
      ),
    ).resolves.toEqual([5])

    expect(
      forumPermissionService.ensureUserCanAccessSection,
    ).toHaveBeenCalledWith(5, 9, { requireEnabled: true })
  })

  it('falls back to the accessible public section set when public search has no explicit section', async () => {
    const forumPermissionService = {
      ensureUserCanAccessSection: jest.fn(),
      getAccessibleSectionIds: jest.fn().mockResolvedValue([3]),
    }
    const service = new ForumSearchService(
      {
        db: {},
        schema: {},
      } as never,
      forumPermissionService as never,
    )

    await expect(
      (service as unknown as ForumSearchServiceTestStubs).resolveSectionScope(
        undefined,
        {
          publicOnly: true,
          userId: 9,
        },
      ),
    ).resolves.toEqual([3])

    expect(forumPermissionService.getAccessibleSectionIds).toHaveBeenCalledWith(
      9,
    )
  })

  it('deduplicates source ids from hashtag reference rows', async () => {
    const service = new ForumSearchService(
      {
        db: {
          select: jest.fn(() => ({
            from: jest.fn(() => ({
              where: jest
                .fn()
                .mockResolvedValue([
                  { sourceId: 11 },
                  { sourceId: 11 },
                  { sourceId: 12 },
                ]),
            })),
          })),
        },
        schema: {
          forumHashtagReference: {
            sourceId: 'sourceId',
            hashtagId: 'hashtagId',
            sourceType: 'sourceType',
            isSourceVisible: 'isSourceVisible',
          },
          forumHashtag: {
            id: 'id',
            auditStatus: 'auditStatus',
            isHidden: 'isHidden',
            deletedAt: 'deletedAt',
          },
        },
      } as never,
      {} as never,
    )

    await expect(
      (
        service as unknown as ForumSearchServicePrivateApi
      ).getSourceIdsByHashtag(77, ForumHashtagReferenceSourceTypeEnum.TOPIC, {
        publicOnly: false,
      }),
    ).resolves.toEqual([11, 12])
  })

  it('prefers hashtagId and falls back to legacy tagId during the compatibility window', () => {
    const service = new ForumSearchService(
      {
        db: {},
        schema: {},
      } as never,
      {} as never,
    )

    expect(
      (
        service as unknown as ForumSearchServiceTestStubs
      ).resolveHashtagFilterId({
        hashtagId: 77,
        tagId: 66,
      }),
    ).toBe(77)
    expect(
      (
        service as unknown as ForumSearchServiceTestStubs
      ).resolveHashtagFilterId({
        tagId: 66,
      }),
    ).toBe(66)
  })

  it('joins forumHashtag when resolving public hashtag source ids', async () => {
    const where = jest.fn().mockResolvedValue([{ sourceId: 11 }])
    const innerJoin = jest.fn(() => ({
      where,
    }))
    const from = jest.fn(() => ({
      innerJoin,
    }))
    const service = new ForumSearchService(
      {
        db: {
          select: jest.fn(() => ({
            from,
          })),
        },
        schema: {
          forumHashtagReference: {
            sourceId: 'sourceId',
            hashtagId: 'hashtagId',
            sourceType: 'sourceType',
            isSourceVisible: 'isSourceVisible',
          },
          forumHashtag: {
            id: 'id',
            auditStatus: 'auditStatus',
            isHidden: 'isHidden',
            deletedAt: 'deletedAt',
          },
        },
      } as never,
      {} as never,
    )

    await expect(
      (
        service as unknown as ForumSearchServicePrivateApi
      ).getSourceIdsByHashtag(77, ForumHashtagReferenceSourceTypeEnum.TOPIC, {
        publicOnly: true,
      }),
    ).resolves.toEqual([11])
    expect(innerJoin).toHaveBeenCalled()
  })

  it('returns an empty page when topic hashtag filter resolves to no topics', async () => {
    const drizzle = {
      db: {},
      ext: {
        findPagination: jest.fn(),
      },
      buildPage: jest.fn((input: { pageIndex: number; pageSize: number }) => ({
        pageIndex: input.pageIndex,
        pageSize: input.pageSize,
        limit: input.pageSize,
        offset: (input.pageIndex - 1) * input.pageSize,
      })),
      schema: {
        forumTopic: {
          id: 'topicId',
          title: 'title',
          content: 'content',
          sectionId: 'sectionId',
          deletedAt: 'deletedAt',
          auditStatus: 'auditStatus',
          isHidden: 'isHidden',
          createdAt: 'createdAt',
          commentCount: 'commentCount',
          likeCount: 'likeCount',
          viewCount: 'viewCount',
          favoriteCount: 'favoriteCount',
        },
      },
    }
    const service = new ForumSearchService(drizzle as never, {} as never)
    const testStubs = service as unknown as ForumSearchServiceTestStubs
    jest.spyOn(testStubs, 'resolveSectionScope').mockResolvedValue(undefined)
    jest.spyOn(testStubs, 'getSourceIdsByHashtag').mockResolvedValue([])

    await expect(
      (service as unknown as ForumSearchServicePrivateApi).searchTopics(
        {
          keyword: 'typescript',
          hashtagId: 77,
          pageIndex: 1,
          pageSize: 10,
        },
        {
          publicOnly: true,
        },
      ),
    ).resolves.toEqual({
      list: [],
      total: 0,
      pageIndex: 1,
      pageSize: 10,
    })
    expect(drizzle.ext.findPagination).not.toHaveBeenCalled()
  })

  it('accepts legacy tagId when resolving topic hashtag filters', async () => {
    const drizzle = {
      db: {},
      ext: {
        findPagination: jest.fn(),
      },
      buildPage: jest.fn((input: { pageIndex: number; pageSize: number }) => ({
        pageIndex: input.pageIndex,
        pageSize: input.pageSize,
        limit: input.pageSize,
        offset: (input.pageIndex - 1) * input.pageSize,
      })),
      schema: {
        forumTopic: {
          id: 'topicId',
          title: 'title',
          content: 'content',
          sectionId: 'sectionId',
          deletedAt: 'deletedAt',
          auditStatus: 'auditStatus',
          isHidden: 'isHidden',
          createdAt: 'createdAt',
          commentCount: 'commentCount',
          likeCount: 'likeCount',
          viewCount: 'viewCount',
          favoriteCount: 'favoriteCount',
        },
      },
    }
    const service = new ForumSearchService(drizzle as never, {} as never)
    const testStubs = service as unknown as ForumSearchServiceTestStubs
    jest.spyOn(testStubs, 'resolveSectionScope').mockResolvedValue(undefined)
    const hashtagSpy = jest
      .spyOn(testStubs, 'getSourceIdsByHashtag')
      .mockResolvedValue([])

    await expect(
      (service as unknown as ForumSearchServicePrivateApi).searchTopics(
        {
          keyword: 'typescript',
          tagId: 77,
          pageIndex: 1,
          pageSize: 10,
        },
        {
          publicOnly: true,
        },
      ),
    ).resolves.toEqual({
      list: [],
      total: 0,
      pageIndex: 1,
      pageSize: 10,
    })
    expect(hashtagSpy).toHaveBeenCalledWith(
      77,
      ForumHashtagReferenceSourceTypeEnum.TOPIC,
      { publicOnly: true },
    )
  })

  it('keeps comment hashtag filtering compatible with both topic refs and comment refs', async () => {
    const drizzle = {
      db: {
        select: jest
          .fn()
          .mockReturnValueOnce(
            createRowsQuery([
              {
                commentId: 33,
                topicId: 9,
                topicTitle: 'TypeScript',
                sectionId: 3,
                userId: 8,
                commentContent: '#TypeScript 很好用',
                createdAt: new Date('2026-04-28T00:00:00.000Z'),
                commentCount: 5,
                viewCount: 10,
                likeCount: 2,
                favoriteCount: 1,
              },
            ]),
          )
          .mockReturnValueOnce(createTotalQuery([{ total: 1 }])),
      },
      buildPage: jest.fn((input: { pageIndex: number; pageSize: number }) => ({
        pageIndex: input.pageIndex,
        pageSize: input.pageSize,
        limit: input.pageSize,
        offset: (input.pageIndex - 1) * input.pageSize,
      })),
      schema: {
        userComment: {
          id: 'commentId',
          targetType: 'targetType',
          deletedAt: 'deletedAt',
          content: 'content',
          targetId: 'targetId',
          auditStatus: 'auditStatus',
          isHidden: 'isHidden',
          userId: 'userId',
          createdAt: 'createdAt',
          likeCount: 'likeCount',
        },
        forumTopic: {
          id: 'topicId',
          title: 'title',
          sectionId: 'sectionId',
          deletedAt: 'deletedAt',
          auditStatus: 'auditStatus',
          isHidden: 'isHidden',
          commentCount: 'commentCount',
          viewCount: 'viewCount',
          favoriteCount: 'favoriteCount',
        },
        forumHashtagReference: {
          sourceId: 'sourceId',
          hashtagId: 'hashtagId',
          sourceType: 'sourceType',
          isSourceVisible: 'isSourceVisible',
        },
      },
    }
    const service = new ForumSearchService(drizzle as never, {} as never)
    const testStubs = service as unknown as ForumSearchServiceTestStubs
    jest.spyOn(testStubs, 'resolveSectionScope').mockResolvedValue(undefined)
    const hashtagSpy = jest
      .spyOn(testStubs, 'getSourceIdsByHashtag')
      .mockImplementation(
        async (
          _hashtagId: number,
          sourceType: ForumHashtagReferenceSourceTypeEnum,
        ) => {
          if (sourceType === ForumHashtagReferenceSourceTypeEnum.TOPIC) {
            return [9]
          }
          return [33]
        },
      )
    jest.spyOn(testStubs, 'mapCommentResults').mockResolvedValue([
      {
        resultType: ForumSearchTypeEnum.COMMENT,
        topicId: 9,
        topicTitle: 'TypeScript',
        sectionId: 3,
        sectionName: '技术',
        userId: 8,
        userNickname: '测试用户',
        commentId: 33,
        commentContentSnippet: '#TypeScript 很好用',
        createdAt: new Date('2026-04-28T00:00:00.000Z'),
        commentCount: 5,
        viewCount: 10,
        likeCount: 2,
        favoriteCount: 1,
      },
    ])

    await expect(
      (service as unknown as ForumSearchServicePrivateApi).searchComments(
        {
          keyword: 'typescript',
          hashtagId: 77,
          pageIndex: 1,
          pageSize: 10,
        },
        {
          publicOnly: true,
        },
      ),
    ).resolves.toEqual({
      list: [
        expect.objectContaining({
          commentId: 33,
        }),
      ],
      total: 1,
      pageIndex: 1,
      pageSize: 10,
    })
    expect(hashtagSpy).toHaveBeenCalledTimes(2)
    expect(hashtagSpy).toHaveBeenCalledWith(
      77,
      ForumHashtagReferenceSourceTypeEnum.TOPIC,
      { publicOnly: true },
    )
    expect(hashtagSpy).toHaveBeenCalledWith(
      77,
      ForumHashtagReferenceSourceTypeEnum.COMMENT,
      { publicOnly: true },
    )
  })
})
