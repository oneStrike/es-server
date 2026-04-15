import * as schema from '@db/schema'
import { EmojiSceneEnum } from '@libs/interaction/emoji/emoji.constant'
import { LikeTargetTypeEnum } from '@libs/interaction/like/like.constant'
import { BadRequestException } from '@nestjs/common'
import { ForumReviewPolicyEnum } from '../forum.constant'
import { ForumTopicService } from './forum-topic.service'

describe('forumTopicService', () => {
  let service: ForumTopicService
  let drizzle: any
  let selectResult: any[]
  let selectResultQueue: any[][]
  let likeService: { checkStatusBatch: jest.Mock }
  let favoriteService: { checkStatusBatch: jest.Mock }
  let growthEventBridgeService: { dispatchDefinedEvent: jest.Mock }
  let sensitiveWordDetectService: {
    getMatchedWords: jest.Mock
    getMatchedWordsWithMetadata: jest.Mock
  }
  let forumCounterService: {
    updateTopicRelatedCounts: jest.Mock
    syncSectionVisibleState: jest.Mock
  }
  let actionLogService: { createActionLog: jest.Mock }
  let forumPermissionService: {
    ensureUserCanCreateTopic: jest.Mock
    ensureUserCanAccessSection: jest.Mock
    getAccessibleSectionIds: jest.Mock
  }
  let mentionService: {
    buildBodyTokens: jest.Mock
    replaceMentionsInTx: jest.Mock
    dispatchTopicMentionsInTx: jest.Mock
  }
  let emojiCatalogService: {
    recordRecentUsageInTx: jest.Mock
  }
  let sensitiveWordStatisticsService: {
    recordEntityHitsInTx: jest.Mock
  }

  beforeEach(() => {
    selectResult = []
    selectResultQueue = []

    const createSelectBuilder = () => {
      const result = selectResultQueue.shift() ?? selectResult
      const builder: any = {
        where: jest.fn(() => builder),
        limit: jest.fn(() => builder),
        offset: jest.fn(() => builder),
        orderBy: jest.fn(() => Promise.resolve(result)),
        then: (
          resolve: (value: unknown[]) => unknown,
          reject?: (error: unknown) => unknown,
        ) => Promise.resolve(result).then(resolve, reject),
      }

      return builder
    }

    drizzle = {
      db: {
        select: jest.fn(() => ({
          from: jest.fn(() => createSelectBuilder()),
        })),
        transaction: jest.fn(),
        $count: jest.fn().mockResolvedValue(0),
      },
      buildPage: jest.fn(({ pageIndex = 1, pageSize = 10 }) => ({
        pageIndex,
        pageSize,
        limit: pageSize,
        offset: (pageIndex - 1) * pageSize,
      })),
      buildOrderBy: jest.fn(() => ({
        orderBySql: [],
      })),
      ext: {
        exists: jest.fn(),
      },
      withErrorHandling: jest.fn(async (fn: () => Promise<unknown>) => fn()),
      schema,
    }

    likeService = {
      checkStatusBatch: jest.fn().mockResolvedValue(new Map([[11, true]])),
    }
    favoriteService = {
      checkStatusBatch: jest.fn().mockResolvedValue(new Map([[11, false]])),
    }
    growthEventBridgeService = {
      dispatchDefinedEvent: jest.fn(),
    }
    sensitiveWordDetectService = {
      getMatchedWords: jest.fn().mockReturnValue({
        hits: [],
        highestLevel: undefined,
      }),
      getMatchedWordsWithMetadata: jest.fn().mockReturnValue({
        hits: [],
        publicHits: [],
        highestLevel: undefined,
      }),
    }
    forumCounterService = {
      updateTopicRelatedCounts: jest.fn(),
      syncSectionVisibleState: jest.fn(),
    }
    actionLogService = {
      createActionLog: jest.fn(),
    }
    forumPermissionService = {
      ensureUserCanCreateTopic: jest.fn(),
      ensureUserCanAccessSection: jest.fn(),
      getAccessibleSectionIds: jest.fn().mockResolvedValue([]),
    }
    mentionService = {
      buildBodyTokens: jest.fn(),
      replaceMentionsInTx: jest.fn(),
      dispatchTopicMentionsInTx: jest.fn(),
    }
    emojiCatalogService = {
      recordRecentUsageInTx: jest.fn(),
    }
    sensitiveWordStatisticsService = {
      recordEntityHitsInTx: jest.fn(),
    }

    service = new (ForumTopicService as any)(
      drizzle,
      growthEventBridgeService as any,
      sensitiveWordDetectService as any,
      {} as any,
      forumCounterService as any,
      {} as any,
      actionLogService as any,
      forumPermissionService as any,
      likeService as any,
      favoriteService as any,
      {} as any,
      mentionService as any,
      emojiCatalogService as any,
      sensitiveWordStatisticsService as any,
    )
  })

  it('收藏主题分页详情不会返回 geoSource', async () => {
    selectResult = [
      {
        id: 11,
        sectionId: 7,
        userId: 3,
        title: '带属地的主题',
        contentSnippet: '正文摘要',
        geoCountry: '中国',
        geoProvince: null,
        geoCity: '深圳市',
        geoIsp: '电信',
        geoSource: 'ip2region',
        images: [],
        videos: [],
        isPinned: false,
        isFeatured: true,
        isLocked: false,
        viewCount: 12,
        commentCount: 5,
        likeCount: 8,
        favoriteCount: 4,
        lastCommentAt: new Date('2026-04-08T00:00:00.000Z'),
        createdAt: new Date('2026-04-07T00:00:00.000Z'),
      },
    ]

    jest
      .spyOn(service as any, 'getTopicSectionBriefMap')
      .mockResolvedValue(
        new Map([[7, { id: 7, name: '默认板块', icon: null, cover: null }]]),
      )
    jest
      .spyOn(service as any, 'getTopicUserBriefMap')
      .mockResolvedValue(
        new Map([[3, { id: 3, nickname: '测试用户', avatarUrl: null }]]),
      )

    const result = await service.batchGetFavoriteTopicDetails([11], 99)

    expect(result.get(11)).toEqual(
      expect.objectContaining({
        id: 11,
        geoCountry: '中国',
        geoProvince: undefined,
        geoCity: '深圳市',
        geoIsp: '电信',
        liked: true,
        favorited: false,
      }),
    )
    expect(result.get(11)).not.toHaveProperty('geoSource')
  })

  it('综合 feed 未传 sectionId 时会按可访问板块聚合主题', async () => {
    selectResult = [
      {
        id: 11,
        sectionId: 7,
        userId: 3,
        title: '综合主题1',
        contentSnippet: '综合主题1摘要',
        geoCountry: null,
        geoProvince: null,
        geoCity: null,
        geoIsp: null,
        images: [],
        videos: [],
        isPinned: true,
        isFeatured: false,
        isLocked: false,
        viewCount: 12,
        commentCount: 5,
        likeCount: 8,
        favoriteCount: 4,
        lastCommentAt: new Date('2026-04-08T00:00:00.000Z'),
        createdAt: new Date('2026-04-07T00:00:00.000Z'),
      },
      {
        id: 12,
        sectionId: 8,
        userId: 4,
        title: '综合主题2',
        contentSnippet: '综合主题2摘要',
        geoCountry: '中国',
        geoProvince: null,
        geoCity: '深圳',
        geoIsp: null,
        images: [],
        videos: [],
        isPinned: false,
        isFeatured: true,
        isLocked: false,
        viewCount: 22,
        commentCount: 15,
        likeCount: 18,
        favoriteCount: 14,
        lastCommentAt: new Date('2026-04-09T00:00:00.000Z'),
        createdAt: new Date('2026-04-08T00:00:00.000Z'),
      },
    ]
    drizzle.db.$count.mockResolvedValue(2)
    forumPermissionService.getAccessibleSectionIds.mockResolvedValue([7, 8])
    jest.spyOn(service as any, 'getTopicSectionBriefMap').mockResolvedValue(
      new Map([
        [7, { id: 7, name: '板块7', icon: null, cover: null }],
        [8, { id: 8, name: '板块8', icon: null, cover: null }],
      ]),
    )
    jest.spyOn(service as any, 'getTopicUserBriefMap').mockResolvedValue(
      new Map([
        [3, { id: 3, nickname: '用户3', avatarUrl: null }],
        [4, { id: 4, nickname: '用户4', avatarUrl: null }],
      ]),
    )
    likeService.checkStatusBatch.mockResolvedValue(
      new Map([
        [11, true],
        [12, false],
      ]),
    )
    favoriteService.checkStatusBatch.mockResolvedValue(
      new Map([
        [11, false],
        [12, true],
      ]),
    )

    const result = await service.getPublicTopics({
      pageIndex: 1,
      pageSize: 10,
      userId: 99,
    } as any)

    expect(forumPermissionService.getAccessibleSectionIds).toHaveBeenCalledWith(
      99,
    )
    expect(
      forumPermissionService.ensureUserCanAccessSection,
    ).not.toHaveBeenCalled()
    expect(likeService.checkStatusBatch).toHaveBeenCalledWith(
      LikeTargetTypeEnum.FORUM_TOPIC,
      [11, 12],
      99,
    )
    expect(result.list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 11,
          liked: true,
          favorited: false,
          section: expect.objectContaining({ id: 7 }),
        }),
        expect.objectContaining({
          id: 12,
          liked: false,
          favorited: true,
          section: expect.objectContaining({ id: 8 }),
          geoCountry: '中国',
          geoCity: '深圳',
        }),
      ]),
    )
  })

  it('热门 feed 使用专属热门排序回退规则', async () => {
    forumPermissionService.getAccessibleSectionIds.mockResolvedValue([7])

    await service.getHotPublicTopics({
      pageIndex: 1,
      pageSize: 10,
    } as any)

    expect(drizzle.buildOrderBy).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        fallbackOrderBy: [
          { commentCount: 'desc' },
          { likeCount: 'desc' },
          { viewCount: 'desc' },
          { createdAt: 'desc' },
        ],
      }),
    )
  })

  it('关注 feed 会聚合关注用户与关注板块的主题', async () => {
    selectResult = [
      {
        id: 31,
        sectionId: 7,
        userId: 3,
        title: '关注用户的主题',
        contentSnippet: '关注用户的主题摘要',
        geoCountry: null,
        geoProvince: null,
        geoCity: null,
        geoIsp: null,
        images: [],
        videos: [],
        isPinned: false,
        isFeatured: false,
        isLocked: false,
        viewCount: 10,
        commentCount: 2,
        likeCount: 3,
        favoriteCount: 1,
        lastCommentAt: new Date('2026-04-10T00:00:00.000Z'),
        createdAt: new Date('2026-04-09T00:00:00.000Z'),
      },
      {
        id: 32,
        sectionId: 8,
        userId: 6,
        title: '关注板块的主题',
        contentSnippet: '关注板块的主题摘要',
        geoCountry: null,
        geoProvince: null,
        geoCity: null,
        geoIsp: null,
        images: [],
        videos: [],
        isPinned: true,
        isFeatured: true,
        isLocked: false,
        viewCount: 20,
        commentCount: 6,
        likeCount: 7,
        favoriteCount: 2,
        lastCommentAt: new Date('2026-04-11T00:00:00.000Z'),
        createdAt: new Date('2026-04-10T00:00:00.000Z'),
      },
    ]
    drizzle.db.$count.mockResolvedValue(2)
    forumPermissionService.getAccessibleSectionIds.mockResolvedValue([7, 8, 9])
    selectResultQueue = [
      [
        { targetType: 1, targetId: 3 },
        { targetType: 3, targetId: 8 },
        { targetType: 2, targetId: 99 },
      ],
      selectResult,
    ]
    jest.spyOn(service as any, 'getTopicSectionBriefMap').mockResolvedValue(
      new Map([
        [7, { id: 7, name: '板块7', icon: null, cover: null }],
        [8, { id: 8, name: '板块8', icon: null, cover: null }],
      ]),
    )
    jest.spyOn(service as any, 'getTopicUserBriefMap').mockResolvedValue(
      new Map([
        [3, { id: 3, nickname: '用户3', avatarUrl: null }],
        [6, { id: 6, nickname: '用户6', avatarUrl: null }],
      ]),
    )
    likeService.checkStatusBatch.mockResolvedValue(
      new Map([
        [31, true],
        [32, false],
      ]),
    )
    favoriteService.checkStatusBatch.mockResolvedValue(
      new Map([
        [31, false],
        [32, true],
      ]),
    )

    const result = await service.getFollowingPublicTopics({
      pageIndex: 1,
      pageSize: 10,
      userId: 99,
    } as any)

    expect(result.list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 31,
          liked: true,
          user: expect.objectContaining({ id: 3 }),
        }),
        expect.objectContaining({
          id: 32,
          favorited: true,
          section: expect.objectContaining({ id: 8 }),
        }),
      ]),
    )
  })

  it('公开主题详情不会返回 geoSource', () => {
    const result = (service as any).buildPublicTopicDetail(
      {
        id: 11,
        sectionId: 7,
        userId: 3,
        title: '带属地的主题',
        content: '正文内容',
        bodyTokens: null,
        geoCountry: '中国',
        geoProvince: null,
        geoCity: '深圳市',
        geoIsp: '电信',
        geoSource: 'ip2region',
        images: [],
        videos: [],
        isPinned: false,
        isFeatured: true,
        isLocked: false,
        commentCount: 5,
        likeCount: 8,
        favoriteCount: 4,
        lastCommentAt: new Date('2026-04-08T00:00:00.000Z'),
        createdAt: new Date('2026-04-07T00:00:00.000Z'),
        updatedAt: new Date('2026-04-08T00:00:00.000Z'),
        user: {
          id: 3,
          nickname: '测试用户',
          avatarUrl: null,
        },
        tags: [],
      },
      {
        liked: true,
        favorited: false,
        isFollowed: false,
        viewCount: 12,
      },
    )

    expect(result).toEqual(
      expect.objectContaining({
        id: 11,
        geoCountry: '中国',
        geoProvince: undefined,
        geoCity: '深圳市',
        geoIsp: '电信',
        viewCount: 12,
      }),
    )
    expect(result).not.toHaveProperty('geoSource')
  })

  it('创建可见主题会构建 mention token 并同步 TOPIC_MENTION 通知', async () => {
    const createdAt = new Date('2026-04-12T10:00:00.000Z')
    const tx = {
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([
            {
              id: 101,
              sectionId: 7,
              userId: 9,
              title: '提及主题',
              content: '欢迎 @测试用户 一起讨论',
              bodyTokens: [
                {
                  type: 'mentionUser',
                  userId: 5,
                  nickname: '测试用户',
                  text: '@测试用户',
                },
                {
                  type: 'emojiCustom',
                  emojiAssetId: 1001,
                  shortcode: 'smile',
                  packCode: 'default',
                  imageUrl: 'https://cdn.example.com/emoji/smile.gif',
                  isAnimated: true,
                },
              ],
              images: [],
              videos: [],
              auditStatus: 1,
              isHidden: false,
              sensitiveWordHits: null,
              createdAt,
              updatedAt: createdAt,
            },
          ]),
        }),
      }),
    }
    drizzle.db.transaction.mockImplementation(async (callback: any) =>
      callback(tx),
    )
    forumPermissionService.ensureUserCanCreateTopic.mockResolvedValue({
      topicReviewPolicy: ForumReviewPolicyEnum.NONE,
    })
    sensitiveWordDetectService.getMatchedWordsWithMetadata.mockReturnValue({
      hits: [
        {
          sensitiveWordId: 1,
          word: '测试',
          start: 0,
          end: 1,
          level: 1,
          type: 4,
        },
      ],
      publicHits: [
        {
          word: '测试',
          start: 0,
          end: 1,
          level: 1,
          type: 4,
        },
      ],
      highestLevel: 1,
    })
    mentionService.buildBodyTokens.mockResolvedValue([
      {
        type: 'mentionUser',
        userId: 5,
        nickname: '测试用户',
        text: '@测试用户',
      },
      {
        type: 'emojiCustom',
        emojiAssetId: 1001,
        shortcode: 'smile',
        packCode: 'default',
        imageUrl: 'https://cdn.example.com/emoji/smile.gif',
        isAnimated: true,
      },
    ])

    await service.createForumTopic({
      sectionId: 7,
      userId: 9,
      title: '提及主题',
      content: '欢迎 @测试用户 一起讨论',
      mentions: [
        {
          userId: 5,
          nickname: '测试用户',
          start: 3,
          end: 8,
        },
      ],
    } as any)

    expect(mentionService.buildBodyTokens).toHaveBeenCalledWith({
      content: '欢迎 @测试用户 一起讨论',
      mentions: [
        {
          userId: 5,
          nickname: '测试用户',
          start: 3,
          end: 8,
        },
      ],
      scene: EmojiSceneEnum.FORUM,
    })
    expect(mentionService.dispatchTopicMentionsInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        topicId: 101,
        actorUserId: 9,
        topicTitle: '提及主题',
      }),
    )
    expect(emojiCatalogService.recordRecentUsageInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        userId: 9,
        scene: EmojiSceneEnum.FORUM,
        items: [{ emojiAssetId: 1001, useCount: 1 }],
      }),
    )
    expect(
      sensitiveWordStatisticsService.recordEntityHitsInTx,
    ).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        entityType: 'topic',
        entityId: 101,
        operationType: 'create',
      }),
    )
  })

  it('更新主题未传 mentions 时会拒绝请求', async () => {
    const currentTopic = {
      id: 101,
      sectionId: 7,
      userId: 9,
      title: '旧标题',
      content: '欢迎 @测试用户 一起讨论',
      bodyTokens: [
        {
          type: 'mentionUser',
          userId: 5,
          nickname: '测试用户',
          text: '@测试用户',
        },
      ],
      images: [],
      videos: [],
      auditStatus: 1,
      isHidden: false,
      isLocked: false,
      deletedAt: null,
      createdAt: new Date('2026-04-12T10:00:00.000Z'),
    }
    const tx = {
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([
              {
                ...currentTopic,
                title: '新标题',
              },
            ]),
          }),
        }),
      }),
    }

    drizzle.db.transaction.mockImplementation(async (callback: any) =>
      callback(tx),
    )
    jest
      .spyOn(service as any, 'getSectionTopicReviewPolicy')
      .mockResolvedValue(ForumReviewPolicyEnum.NONE)

    await expect(
      (service as any).updateTopicWithCurrent(
        currentTopic,
        {
          id: 101,
          title: '新标题',
          content: currentTopic.content,
        },
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('后台更新主题时 TOPIC_MENTION 通知会使用当前操作者', async () => {
    const currentTopic = {
      id: 101,
      sectionId: 7,
      userId: 9,
      title: '旧标题',
      content: '欢迎 @测试用户 一起讨论',
      bodyTokens: null,
      images: [],
      videos: [],
      auditStatus: 1,
      isHidden: false,
      isLocked: false,
      deletedAt: null,
      createdAt: new Date('2026-04-12T10:00:00.000Z'),
    }
    const tx = {
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([
              {
                ...currentTopic,
                bodyTokens: [
                  {
                    type: 'mentionUser',
                    userId: 5,
                    nickname: '测试用户',
                    text: '@测试用户',
                  },
                  {
                    type: 'emojiUnicode',
                    unicodeSequence: '😀',
                    emojiAssetId: 2001,
                  },
                ],
              },
            ]),
          }),
        }),
      }),
    }

    drizzle.db.transaction.mockImplementation(async (callback: any) =>
      callback(tx),
    )
    jest
      .spyOn(service as any, 'getActiveTopicOrThrow')
      .mockResolvedValue(currentTopic)
    jest
      .spyOn(service as any, 'getSectionTopicReviewPolicy')
      .mockResolvedValue(ForumReviewPolicyEnum.NONE)
    sensitiveWordDetectService.getMatchedWordsWithMetadata.mockReturnValue({
      hits: [
        {
          sensitiveWordId: 2,
          word: '旧标题',
          start: 0,
          end: 2,
          level: 2,
          type: 5,
        },
      ],
      publicHits: [
        {
          word: '旧标题',
          start: 0,
          end: 2,
          level: 2,
          type: 5,
        },
      ],
      highestLevel: 2,
    })
    mentionService.buildBodyTokens.mockResolvedValue([
      {
        type: 'mentionUser',
        userId: 5,
        nickname: '测试用户',
        text: '@测试用户',
      },
      {
        type: 'emojiUnicode',
        unicodeSequence: '😀',
        emojiAssetId: 2001,
      },
    ])

    await (service as any).updateTopic(
      {
        id: 101,
        title: currentTopic.title,
        content: currentTopic.content,
        mentions: [
          {
            userId: 5,
            nickname: '测试用户',
            start: 3,
            end: 8,
          },
        ],
      },
      {},
      77,
    )

    expect(mentionService.dispatchTopicMentionsInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        topicId: 101,
        actorUserId: 77,
        topicTitle: '旧标题',
      }),
    )
    expect(emojiCatalogService.recordRecentUsageInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        userId: 77,
        scene: EmojiSceneEnum.FORUM,
        items: [{ emojiAssetId: 2001, useCount: 1 }],
      }),
    )
    expect(
      sensitiveWordStatisticsService.recordEntityHitsInTx,
    ).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        entityType: 'topic',
        entityId: 101,
        operationType: 'update',
      }),
    )
  })
})
