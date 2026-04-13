import * as schema from '@db/schema'
import { ForumTopicCommentResolver } from '@libs/forum/topic/resolver/forum-topic-comment.resolver'
import { AuditStatusEnum } from '@libs/platform/constant/audit.constant'
import { CommentSortTypeEnum, CommentTargetTypeEnum } from './comment.constant'
import { CommentService } from './comment.service'

function createSelectChain(result: {
  whereResult?: unknown
  orderByResult?: unknown
  limitResult?: unknown
  offsetResult?: unknown
  asResult?: unknown
}) {
  const chain: Record<string, jest.Mock> = {
    from: jest.fn(() => chain),
    innerJoin: jest.fn(() => chain),
    leftJoin: jest.fn(() => chain),
    where: jest.fn(() => result.whereResult ?? chain),
    groupBy: jest.fn(() => chain),
    orderBy: jest.fn(() => result.orderByResult ?? chain),
    limit: jest.fn(() => result.limitResult ?? chain),
    offset: jest.fn(() => result.offsetResult ?? []),
    as: jest.fn(() => result.asResult ?? { rn: 1 }),
  }

  return chain
}

describe('commentService', () => {
  let service: CommentService
  let drizzle: any
  let findPaginationMock: jest.Mock
  let selectWhereMock: jest.Mock
  let forumTopicFindFirstMock: jest.Mock
  let userCommentFindFirstMock: jest.Mock
  let withTransactionMock: jest.Mock
  let sensitiveWordDetectService: { getMatchedWords: jest.Mock }
  let configReader: { getContentReviewPolicy: jest.Mock }
  let commentGrowthService: { rewardCommentCreated: jest.Mock }
  let likeService: { checkStatusBatch: jest.Mock }
  let messageDomainEventPublisher: { publishInTx: jest.Mock }
  let messageDomainEventFactoryService: {
    buildCommentRepliedEvent: jest.Mock
  }
  let commentPermissionService: { ensureCanComment: jest.Mock }
  let appUserCountService: {
    updateCommentCount: jest.Mock
    updateCommentReceivedLikeCount: jest.Mock
  }
  let emojiCatalogService: { recordRecentUsageInTx: jest.Mock }
  let mentionService: {
    buildBodyTokens: jest.Mock
    replaceMentionsInTx: jest.Mock
    dispatchCommentMentionsInTx: jest.Mock
    deleteMentionsInTx: jest.Mock
  }

  beforeEach(() => {
    findPaginationMock = jest.fn()
    selectWhereMock = jest.fn()
    forumTopicFindFirstMock = jest.fn()
    userCommentFindFirstMock = jest.fn()
    withTransactionMock = jest.fn()
    sensitiveWordDetectService = {
      getMatchedWords: jest.fn().mockReturnValue({
        hits: [],
        highestLevel: undefined,
      }),
    }
    configReader = {
      getContentReviewPolicy: jest.fn().mockReturnValue({
        severeAction: {
          auditStatus: AuditStatusEnum.REJECTED,
          isHidden: true,
        },
        generalAction: {
          auditStatus: AuditStatusEnum.PENDING,
          isHidden: false,
        },
        lightAction: {
          auditStatus: AuditStatusEnum.APPROVED,
          isHidden: false,
        },
        recordHits: true,
      }),
    }
    commentGrowthService = {
      rewardCommentCreated: jest.fn(),
    }

    drizzle = {
      db: {
        select: jest.fn(() => ({
          from: jest.fn(() => ({
            where: selectWhereMock,
          })),
        })),
        query: {
          forumTopic: {
            findFirst: forumTopicFindFirstMock,
          },
          userComment: {
            findFirst: userCommentFindFirstMock,
          },
        },
      },
      ext: {
        findPagination: findPaginationMock,
      },
      schema,
      withTransaction: withTransactionMock,
    }

    likeService = {
      checkStatusBatch: jest.fn().mockResolvedValue(new Map([[11, true]])),
    }
    messageDomainEventPublisher = {
      publishInTx: jest.fn(),
    }
    messageDomainEventFactoryService = {
      buildCommentRepliedEvent: jest.fn(),
    }
    commentPermissionService = {
      ensureCanComment: jest.fn(),
    }
    appUserCountService = {
      updateCommentCount: jest.fn(),
      updateCommentReceivedLikeCount: jest.fn(),
    }
    emojiCatalogService = {
      recordRecentUsageInTx: jest.fn(),
    }
    mentionService = {
      buildBodyTokens: jest.fn(),
      replaceMentionsInTx: jest.fn(),
      dispatchCommentMentionsInTx: jest.fn(),
      deleteMentionsInTx: jest.fn(),
    }

    service = new (CommentService as any)(
      sensitiveWordDetectService as any,
      configReader as any,
      commentPermissionService as any,
      commentGrowthService as any,
      likeService as any,
      messageDomainEventPublisher as any,
      messageDomainEventFactoryService as any,
      appUserCountService as any,
      drizzle,
      mentionService as any,
      emojiCatalogService as any,
    )
  })

  it('评论回复分页不会返回 geoSource', async () => {
    findPaginationMock.mockResolvedValue({
      list: [
        {
          id: 11,
          targetType: CommentTargetTypeEnum.FORUM_TOPIC,
          targetId: 7,
          userId: 3,
          content: '回复内容',
          bodyTokens: null,
          floor: 2,
          replyToId: 1,
          actualReplyToId: 1,
          likeCount: 0,
          geoCountry: '中国',
          geoProvince: null,
          geoCity: '深圳市',
          geoIsp: '电信',
          geoSource: 'ip2region',
          createdAt: new Date('2026-04-08T00:00:00.000Z'),
        },
      ],
      total: 1,
      pageIndex: 1,
      pageSize: 10,
    })
    selectWhereMock.mockResolvedValueOnce([
      {
        id: 3,
        nickname: '测试用户',
        avatarUrl: null,
      },
    ])

    const result = await service.getReplies({
      commentId: 1,
      pageIndex: 1,
      pageSize: 10,
      userId: 99,
    })

    expect(result.list[0]).toEqual(
      expect.objectContaining({
        id: 11,
        geoCountry: '中国',
        geoProvince: null,
        geoCity: '深圳市',
        geoIsp: '电信',
        liked: true,
      }),
    )
    expect(result.list[0]).not.toHaveProperty('geoSource')
    expect(result.list[0]).not.toHaveProperty('actualReplyToId')
    expect(result.list[0]).not.toHaveProperty('replyTo')
  })

  it('评论回复分页仅在回复楼中楼时返回 replyTo', async () => {
    findPaginationMock.mockResolvedValue({
      list: [
        {
          id: 12,
          targetType: CommentTargetTypeEnum.FORUM_TOPIC,
          targetId: 7,
          userId: 3,
          content: '回复二级评论',
          bodyTokens: null,
          floor: 3,
          replyToId: 10,
          actualReplyToId: 1,
          likeCount: 0,
          geoCountry: '中国',
          geoProvince: null,
          geoCity: '深圳市',
          geoIsp: '电信',
          createdAt: new Date('2026-04-08T00:10:00.000Z'),
        },
      ],
      total: 1,
      pageIndex: 1,
      pageSize: 10,
    })
    selectWhereMock
      .mockResolvedValueOnce([
        {
          id: 3,
          nickname: '测试用户',
          avatarUrl: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 10,
          userId: 4,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 4,
          nickname: '被回复用户',
          avatarUrl: null,
        },
      ])
    likeService.checkStatusBatch.mockResolvedValueOnce(new Map([[12, true]]))

    const result = await service.getReplies({
      commentId: 1,
      pageIndex: 1,
      pageSize: 10,
      userId: 99,
    })

    expect(result.list[0]).toEqual(
      expect.objectContaining({
        id: 12,
        liked: true,
        replyTo: {
          id: 10,
          userId: 4,
          user: {
            id: 4,
            nickname: '被回复用户',
            avatarUrl: null,
          },
        },
      }),
    )
  })

  it('评论回复热度排序会按点赞数优先并返回作者评论标记', async () => {
    findPaginationMock.mockResolvedValue({
      list: [
        {
          id: 11,
          targetType: CommentTargetTypeEnum.FORUM_TOPIC,
          targetId: 7,
          userId: 3,
          content: '作者回复',
          bodyTokens: null,
          floor: 2,
          replyToId: 1,
          actualReplyToId: 1,
          likeCount: 9,
          geoCountry: '中国',
          geoProvince: null,
          geoCity: '深圳市',
          geoIsp: '电信',
          createdAt: new Date('2026-04-08T00:00:00.000Z'),
        },
      ],
      total: 1,
      pageIndex: 1,
      pageSize: 10,
    })
    selectWhereMock.mockResolvedValue([
      {
        id: 3,
        nickname: '作者用户',
        avatarUrl: null,
      },
    ])
    userCommentFindFirstMock.mockResolvedValue({
      id: 1,
      targetType: CommentTargetTypeEnum.FORUM_TOPIC,
      targetId: 7,
    })
    forumTopicFindFirstMock.mockResolvedValue({
      userId: 3,
    })

    const result = await service.getReplies({
      commentId: 1,
      pageIndex: 1,
      pageSize: 10,
      userId: 99,
      sort: CommentSortTypeEnum.HOT,
    })

    expect(findPaginationMock).toHaveBeenCalledWith(
      schema.userComment,
      expect.objectContaining({
        orderBy: [{ likeCount: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      }),
    )
    expect(result.list[0]).toEqual(
      expect.objectContaining({
        id: 11,
        isAuthorComment: true,
      }),
    )
  })

  it('我的评论分页不会返回 geoSource', async () => {
    findPaginationMock.mockResolvedValue({
      list: [
        {
          id: 12,
          targetType: CommentTargetTypeEnum.FORUM_TOPIC,
          targetId: 7,
          userId: 3,
          content: '我的评论',
          bodyTokens: null,
          floor: 1,
          replyToId: 11,
          actualReplyToId: 11,
          isHidden: false,
          auditStatus: 1,
          auditById: null,
          auditRole: null,
          auditReason: null,
          auditAt: null,
          likeCount: 2,
          sensitiveWordHits: null,
          geoCountry: '中国',
          geoProvince: null,
          geoCity: '深圳市',
          geoIsp: '电信',
          geoSource: 'ip2region',
          deletedAt: null,
          createdAt: new Date('2026-04-08T00:00:00.000Z'),
          updatedAt: new Date('2026-04-08T00:00:00.000Z'),
        },
      ],
      total: 1,
      pageIndex: 1,
      pageSize: 10,
    })

    const result = await service.getUserComments(
      {
        pageIndex: 1,
        pageSize: 10,
      },
      3,
    )

    expect(result.list[0]).toEqual(
      expect.objectContaining({
        id: 12,
        geoCountry: '中国',
        geoCity: '深圳市',
        geoIsp: '电信',
      }),
    )
    expect(result.list[0]).not.toHaveProperty('geoSource')
    expect(result.list[0]).not.toHaveProperty('replyTo')
  })

  it('我的评论分页支持热度排序', async () => {
    findPaginationMock.mockResolvedValue({
      list: [],
      total: 0,
      pageIndex: 1,
      pageSize: 10,
    })

    await service.getUserComments(
      {
        pageIndex: 1,
        pageSize: 10,
        sort: CommentSortTypeEnum.HOT,
      },
      3,
    )

    expect(findPaginationMock).toHaveBeenCalledWith(
      schema.userComment,
      expect.objectContaining({
        orderBy: [{ likeCount: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      }),
    )
  })

  it('主题评论最热排序会走手写分页并按作者口径返回结果', async () => {
    const buildPageMock = jest.fn().mockReturnValue({
      pageIndex: 1,
      pageSize: 10,
      limit: 10,
      offset: 0,
    })
    const rootCreatedAt = new Date('2026-04-08T00:00:00.000Z')
    const replyCreatedAt = new Date('2026-04-08T01:00:00.000Z')

    drizzle.buildPage = buildPageMock
    drizzle.db.select = jest.fn((fields?: Record<string, unknown>) => {
      const fieldKeys = fields ? Object.keys(fields) : []

      if (fieldKeys.includes('replyCount')) {
        return createSelectChain({
          offsetResult: [
            {
              id: 101,
              userId: 5,
              targetType: CommentTargetTypeEnum.FORUM_TOPIC,
              targetId: 7,
              content: '作者主评论',
              bodyTokens: null,
              floor: 1,
              likeCount: 8,
              geoCountry: undefined,
              geoProvince: undefined,
              geoCity: undefined,
              geoIsp: undefined,
              createdAt: rootCreatedAt,
              replyCount: 1,
            },
          ],
        })
      }

      if (fieldKeys.includes('count')) {
        return createSelectChain({
          whereResult: [{ count: 1 }],
        })
      }

      if (fieldKeys.includes('totalCount')) {
        return createSelectChain({
          asResult: { rn: 1 },
        })
      }

      if (
        fieldKeys.length === 2 &&
        fieldKeys.includes('id') &&
        fieldKeys.includes('userId')
      ) {
        return createSelectChain({
          whereResult: [{ id: 101, userId: 5 }],
        })
      }

      if (fieldKeys.includes('nickname')) {
        return createSelectChain({
          whereResult: [{ id: 5, nickname: '作者', avatarUrl: null }],
        })
      }

      return createSelectChain({
        whereResult: [
          {
            id: 201,
            userId: 5,
            actualReplyToId: 101,
            replyToId: 101,
            content: '作者回复',
            bodyTokens: null,
            likeCount: 2,
            geoCountry: undefined,
            geoProvince: undefined,
            geoCity: undefined,
            geoIsp: undefined,
            createdAt: replyCreatedAt,
            totalCount: 1,
          },
        ],
      })
    })
    findPaginationMock.mockResolvedValue({
      list: [
        {
          id: 101,
          userId: 5,
          targetType: CommentTargetTypeEnum.FORUM_TOPIC,
          targetId: 7,
          content: '作者主评论',
          bodyTokens: null,
          floor: 1,
          likeCount: 8,
          geoCountry: undefined,
          geoProvince: undefined,
          geoCity: undefined,
          geoIsp: undefined,
          createdAt: rootCreatedAt,
        },
      ],
      total: 1,
      pageIndex: 1,
      pageSize: 10,
    })
    forumTopicFindFirstMock.mockResolvedValue({
      userId: 5,
    })
    likeService.checkStatusBatch.mockResolvedValue(new Map())

    const result = await service.getTargetComments({
      targetType: CommentTargetTypeEnum.FORUM_TOPIC,
      targetId: 7,
      pageIndex: 1,
      pageSize: 10,
      previewReplyLimit: 3,
      userId: 99,
      sort: CommentSortTypeEnum.HOT,
      onlyAuthor: true,
    })

    expect(buildPageMock).toHaveBeenCalledWith({
      pageIndex: 1,
      pageSize: 10,
    })
    expect(findPaginationMock).not.toHaveBeenCalled()
    expect(result.list[0]).toEqual(
      expect.objectContaining({
        id: 101,
        isAuthorComment: true,
        replyCount: 1,
        hasMoreReplies: false,
      }),
    )
    expect((result.list[0] as any).previewReplies[0]).toEqual(
      expect.objectContaining({
        id: 201,
        isAuthorComment: true,
      }),
    )
    expect((result.list[0] as any).previewReplies[0]).not.toHaveProperty(
      'replyTo',
    )
  })

  it('回复隐藏评论时会拒绝请求', async () => {
    mentionService.buildBodyTokens.mockResolvedValue([])
    userCommentFindFirstMock.mockResolvedValue({
      id: 1,
      targetType: CommentTargetTypeEnum.FORUM_TOPIC,
      targetId: 7,
      userId: 3,
      replyToId: null,
      actualReplyToId: null,
      deletedAt: null,
      auditStatus: AuditStatusEnum.APPROVED,
      isHidden: true,
    })

    await expect(
      service.replyComment({
        userId: 9,
        replyToId: 1,
        content: '回复隐藏评论',
        mentions: [],
      } as any),
    ).rejects.toThrow('回复目标不存在')
  })

  it('可见回复评论会记录 COMMENT 场景 recent emoji usage', async () => {
    const createdAt = new Date('2026-04-08T00:00:00.000Z')
    const tx = {
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([
            {
              id: 11,
              userId: 9,
              targetType: CommentTargetTypeEnum.FORUM_TOPIC,
              targetId: 7,
              replyToId: 1,
              content: '回复 :smile:',
              createdAt,
            },
          ]),
        }),
      }),
      query: {
        appUser: {
          findFirst: jest.fn().mockResolvedValue({
            nickname: '回复者',
          }),
        },
      },
    }
    const mockResolver = {
      targetType: CommentTargetTypeEnum.FORUM_TOPIC,
      ensureCanComment: jest.fn(),
      applyCountDelta: jest.fn(),
      resolveMeta: jest.fn().mockResolvedValue({
        targetDisplayTitle: '论坛主题',
      }),
    }
    service.registerResolver(mockResolver as any)
    withTransactionMock.mockImplementation(async (callback: any) =>
      callback(tx),
    )
    mentionService.buildBodyTokens.mockResolvedValue([
      {
        type: 'emojiCustom',
        emojiAssetId: 1001,
        shortcode: 'smile',
        packCode: 'default',
        imageUrl: 'https://cdn.example.com/smile.gif',
        isAnimated: true,
      },
    ])
    mentionService.replaceMentionsInTx.mockResolvedValue({
      mentionedUserIds: [],
      pendingUserIds: [],
    })
    userCommentFindFirstMock.mockResolvedValue({
      id: 1,
      targetType: CommentTargetTypeEnum.FORUM_TOPIC,
      targetId: 7,
      userId: 3,
      replyToId: null,
      actualReplyToId: null,
      deletedAt: null,
      auditStatus: AuditStatusEnum.APPROVED,
      isHidden: false,
    })
    messageDomainEventFactoryService.buildCommentRepliedEvent.mockReturnValue({
      eventKey: 'comment.replied',
      projectionKey: 'comment:reply:11:to:3',
    })

    await service.replyComment({
      userId: 9,
      replyToId: 1,
      content: '回复 :smile:',
      mentions: [],
    } as any)

    expect(emojiCatalogService.recordRecentUsageInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        userId: 9,
        scene: 2,
        items: [{ emojiAssetId: 1001, useCount: 1 }],
      }),
    )
  })

  it('可见回复评论仍只会入队 COMMENT_REPLY 通知事件', async () => {
    const createdAt = new Date('2026-04-08T00:00:00.000Z')
    const tx = {
      query: {
        appUser: {
          findFirst: jest.fn().mockResolvedValue({
            nickname: '回复者',
          }),
        },
        userComment: {
          findFirst: jest.fn(),
        },
      },
    }
    const eventEnvelope = (service as any).buildCommentCreatedEventEnvelope({
      commentId: 11,
      userId: 9,
      targetType: CommentTargetTypeEnum.FORUM_TOPIC,
      targetId: 7,
      replyToId: 1,
      occurredAt: createdAt,
      auditStatus: AuditStatusEnum.APPROVED,
      isHidden: false,
    })
    messageDomainEventFactoryService.buildCommentRepliedEvent.mockReturnValue({
      eventKey: 'comment.replied',
      projectionKey: 'comment:reply:11:to:3',
    })

    await (service as any).compensateVisibleCommentEffects(
      tx,
      {
        id: 11,
        userId: 9,
        targetType: CommentTargetTypeEnum.FORUM_TOPIC,
        targetId: 7,
        replyToId: 1,
        content: '回复内容',
        createdAt,
        replyTargetUserId: 3,
      },
      {
        targetDisplayTitle: '论坛主题',
      },
      eventEnvelope,
    )

    expect(
      messageDomainEventFactoryService.buildCommentRepliedEvent,
    ).toHaveBeenCalled()
    expect(
      messageDomainEventPublisher.publishInTx,
    ).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        eventKey: 'comment.replied',
      }),
    )
  })

  it('可见回复评论命中提及时会补发 COMMENT_MENTION 通知', async () => {
    const createdAt = new Date('2026-04-08T00:00:00.000Z')
    const tx = {
      query: {
        appUser: {
          findFirst: jest.fn().mockResolvedValue({
            nickname: '回复者',
          }),
        },
        userComment: {
          findFirst: jest.fn(),
        },
      },
    }
    const eventEnvelope = (service as any).buildCommentCreatedEventEnvelope({
      commentId: 11,
      userId: 9,
      targetType: CommentTargetTypeEnum.FORUM_TOPIC,
      targetId: 7,
      replyToId: 1,
      occurredAt: createdAt,
      auditStatus: AuditStatusEnum.APPROVED,
      isHidden: false,
    })
    messageDomainEventFactoryService.buildCommentRepliedEvent.mockReturnValue({
      eventKey: 'comment.replied',
      projectionKey: 'comment:reply:11:to:3',
    })

    await (service as any).compensateVisibleCommentEffects(
      tx,
      {
        id: 11,
        userId: 9,
        targetType: CommentTargetTypeEnum.FORUM_TOPIC,
        targetId: 7,
        replyToId: 1,
        content: '回复内容并 @测试用户',
        createdAt,
        replyTargetUserId: 3,
      },
      {
        targetDisplayTitle: '论坛主题',
      },
      eventEnvelope,
    )

    expect(mentionService.dispatchCommentMentionsInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        commentId: 11,
        actorUserId: 9,
        targetType: CommentTargetTypeEnum.FORUM_TOPIC,
        targetId: 7,
        content: '回复内容并 @测试用户',
        targetDisplayTitle: '论坛主题',
      }),
    )
  })

  it('论坛主题只有一级评论会触发 TOPIC_COMMENT 通知', async () => {
    const messageDomainEventPublisherForResolver = {
      publishInTx: jest.fn(),
    }
    const domainEventFactory = {
      buildTopicCommentedEvent: jest.fn().mockReturnValue({
        eventKey: 'topic.commented',
        projectionKey: 'notify:topic-comment:5:7:comment:101:receiver:5',
      }),
    }
    const forumCounterService = {
      syncTopicCommentState: jest.fn(),
      syncSectionVisibleState: jest.fn(),
    }
    const resolver = new ForumTopicCommentResolver(
      {
        registerResolver: jest.fn(),
      } as any,
      messageDomainEventPublisherForResolver as any,
      domainEventFactory as any,
      forumCounterService as any,
    )
    const tx = {
      query: {
        appUser: {
          findFirst: jest.fn().mockResolvedValue({
            nickname: '评论者',
          }),
        },
      },
    }

    await resolver.postCommentHook(
      tx as any,
      {
        id: 101,
        userId: 9,
        targetType: CommentTargetTypeEnum.FORUM_TOPIC,
        targetId: 7,
        replyToId: null,
        content: '一级评论',
        createdAt: new Date('2026-04-08T00:00:00.000Z'),
      },
      {
        ownerUserId: 5,
        sectionId: 1,
        targetDisplayTitle: '论坛主题',
      },
    )

    await resolver.postCommentHook(
      tx as any,
      {
        id: 102,
        userId: 9,
        targetType: CommentTargetTypeEnum.FORUM_TOPIC,
        targetId: 7,
        replyToId: 101,
        content: '楼中楼回复',
        createdAt: new Date('2026-04-08T01:00:00.000Z'),
      },
      {
        ownerUserId: 5,
        sectionId: 1,
        targetDisplayTitle: '论坛主题',
      },
    )

    expect(domainEventFactory.buildTopicCommentedEvent).toHaveBeenCalledTimes(1)
    expect(messageDomainEventPublisherForResolver.publishInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        eventKey: 'topic.commented',
      }),
    )
  })
})
