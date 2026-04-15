import * as schema from '@db/schema'
import { EmojiSceneEnum } from '@libs/interaction/emoji/emoji.constant'
import { BadRequestException } from '@nestjs/common'
import { ForumReviewPolicyEnum } from '../forum.constant'
import { ForumTopicService } from './forum-topic.service'

describe('forumTopicService', () => {
  let service: ForumTopicService
  let drizzle: any
  let selectWhereMock: jest.Mock
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
  let forumPermissionService: { ensureUserCanCreateTopic: jest.Mock }
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
    selectWhereMock = jest.fn()

    drizzle = {
      db: {
        select: jest.fn(() => ({
          from: jest.fn(() => ({
            where: selectWhereMock,
          })),
        })),
        transaction: jest.fn(),
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
    selectWhereMock.mockResolvedValue([
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
    ])

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
    expect(sensitiveWordStatisticsService.recordEntityHitsInTx).toHaveBeenCalledWith(
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
    expect(sensitiveWordStatisticsService.recordEntityHitsInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        entityType: 'topic',
        entityId: 101,
        operationType: 'update',
      }),
    )
  })
})
