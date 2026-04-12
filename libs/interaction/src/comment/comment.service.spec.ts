import * as schema from '@db/schema'
import { ForumTopicCommentResolver } from '@libs/forum/topic/resolver/forum-topic-comment.resolver'
import {
  MessageNotificationTypeEnum,
} from '@libs/message/notification/notification.constant'
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
  let likeService: { checkStatusBatch: jest.Mock }
  let messageOutboxService: { enqueueNotificationEventInTx: jest.Mock }
  let messageNotificationComposerService: {
    buildCommentReplyEvent: jest.Mock
    buildCommentMentionEvent: jest.Mock
  }
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
    }

    likeService = {
      checkStatusBatch: jest.fn().mockResolvedValue(new Map([[11, true]])),
    }
    messageOutboxService = {
      enqueueNotificationEventInTx: jest.fn(),
    }
    messageNotificationComposerService = {
      buildCommentReplyEvent: jest.fn(),
      buildCommentMentionEvent: jest.fn(),
    }
    mentionService = {
      buildBodyTokens: jest.fn(),
      replaceMentionsInTx: jest.fn(),
      dispatchCommentMentionsInTx: jest.fn(),
      deleteMentionsInTx: jest.fn(),
    }

    service = new (CommentService as any)(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      likeService as any,
      messageOutboxService as any,
      messageNotificationComposerService as any,
      {} as any,
      drizzle,
      mentionService as any,
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
    selectWhereMock.mockResolvedValue([
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
        orderBy: [
          { likeCount: 'desc' },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
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
          replyToId: null,
          actualReplyToId: null,
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
        orderBy: [
          { likeCount: 'desc' },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
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
    messageNotificationComposerService.buildCommentReplyEvent.mockReturnValue({
      bizKey: 'comment:reply:11:to:3',
      payload: {
        type: MessageNotificationTypeEnum.COMMENT_REPLY,
      },
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
      messageNotificationComposerService.buildCommentReplyEvent,
    ).toHaveBeenCalled()
    expect(messageOutboxService.enqueueNotificationEventInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        payload: expect.objectContaining({
          type: MessageNotificationTypeEnum.COMMENT_REPLY,
        }),
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
    messageNotificationComposerService.buildCommentReplyEvent.mockReturnValue({
      bizKey: 'comment:reply:11:to:3',
      payload: {
        type: MessageNotificationTypeEnum.COMMENT_REPLY,
      },
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
    const messageOutbox = {
      enqueueNotificationEventInTx: jest.fn(),
    }
    const notificationComposer = {
      buildTopicCommentEvent: jest.fn().mockReturnValue({
        bizKey: 'notify:topic-comment:5:7:comment:101:receiver:5',
        payload: {
          type: MessageNotificationTypeEnum.TOPIC_COMMENT,
        },
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
      messageOutbox as any,
      notificationComposer as any,
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

    expect(notificationComposer.buildTopicCommentEvent).toHaveBeenCalledTimes(1)
    expect(messageOutbox.enqueueNotificationEventInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        payload: expect.objectContaining({
          type: MessageNotificationTypeEnum.TOPIC_COMMENT,
        }),
      }),
    )
  })
})
