import { AuditStatusEnum } from '@libs/platform/constant/audit.constant'
import { CommentTargetTypeEnum } from '../comment.constant'

jest.mock('@db/core', () => ({
  buildILikeCondition: jest.fn((_column: unknown, value?: string) =>
    value ? { type: 'ilike', value } : undefined,
  ),
  buildLikePattern: jest.fn((value?: string) =>
    value?.trim() ? `%${value.trim()}%` : undefined,
  ),
  DrizzleService: class {},
  escapeLikePattern: (value: string) => value,
}))

jest.mock('../../emoji/emoji-parser.service', () => ({
  EmojiParserService: class {},
}))

jest.mock('../../emoji/emoji.constant', () => ({
  EmojiSceneEnum: {
    COMMENT: 'COMMENT',
  },
}))

jest.mock('../../like/like.service', () => ({
  LikeService: class {},
}))

jest.mock('@libs/message/outbox/outbox.service', () => ({
  MessageOutboxService: class {},
}))

jest.mock('@libs/message/notification/notification-composer.service', () => ({
  MessageNotificationComposerService: class {},
}))

jest.mock('@libs/sensitive-word/sensitive-word-detect.service', () => ({
  SensitiveWordDetectService: class {},
}))

jest.mock('@libs/sensitive-word/sensitive-word-constant', () => ({
  SensitiveWordLevelEnum: {
    LIGHT: 1,
    GENERAL: 2,
    SEVERE: 3,
  },
}))

jest.mock('@libs/system-config/config-reader', () => ({
  ConfigReader: class {},
}))

jest.mock('@libs/user/app-user-count.service', () => ({
  AppUserCountService: class {},
}))

async function createCommentService(drizzle: any) {
  const { CommentService } = await import('../comment.service')

  const service = new CommentService(
    {
      getMatchedWords: jest.fn().mockReturnValue({
        highestLevel: 2,
        hits: ['敏感词'],
      }),
    } as any,
    {
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
        recordHits: false,
      }),
    } as any,
    {
      ensureCanComment: jest.fn().mockResolvedValue(undefined),
    } as any,
    {
      rewardCommentCreated: jest.fn().mockResolvedValue(undefined),
    } as any,
    {} as any,
    {
      enqueueNotificationEventInTx: jest.fn().mockResolvedValue(undefined),
    } as any,
    {
      buildCommentReplyEvent: jest.fn(),
    } as any,
    {
      updateCommentCount: jest.fn().mockResolvedValue(undefined),
    } as any,
    {
      parse: jest.fn().mockResolvedValue([]),
    } as any,
    drizzle,
  )

  service.registerResolver({
    targetType: CommentTargetTypeEnum.COMIC,
    ensureCanComment: jest.fn().mockResolvedValue(undefined),
    applyCountDelta: jest.fn().mockResolvedValue(undefined),
    resolveMeta: jest.fn().mockResolvedValue({
      ownerUserId: 42,
      targetDisplayTitle: '测试内容',
    }),
  } as any)

  return service
}

describe('comment geo contract', () => {
  it('requests geo fields in reply and target comment pagination projections', async () => {
    const findPagination = jest.fn().mockResolvedValue({
      list: [],
      total: 0,
      pageIndex: 1,
      pageSize: 20,
    })

    const service = await createCommentService({
      db: {},
      ext: {
        findPagination,
      },
      schema: {
        appUserComment: {
          id: 'id',
          actualReplyToId: 'actualReplyToId',
          auditStatus: 'auditStatus',
          isHidden: 'isHidden',
          deletedAt: 'deletedAt',
          createdAt: 'createdAt',
          targetType: 'targetType',
          targetId: 'targetId',
          userId: 'userId',
          content: 'content',
          bodyTokens: 'bodyTokens',
          floor: 'floor',
          replyToId: 'replyToId',
          likeCount: 'likeCount',
        },
        appUser: {},
      },
    } as any)

    await service.getReplies({
      commentId: 77,
      pageIndex: 1,
      pageSize: 20,
    })
    await service.getTargetComments({
      targetType: CommentTargetTypeEnum.COMIC,
      targetId: 901,
      pageIndex: 1,
      pageSize: 20,
    })

    expect(findPagination).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        pick: expect.arrayContaining([
          'geoCountry',
          'geoProvince',
          'geoCity',
          'geoIsp',
          'geoSource',
        ]),
      }),
    )
    expect(findPagination).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        pick: expect.arrayContaining([
          'geoCountry',
          'geoProvince',
          'geoCity',
          'geoIsp',
          'geoSource',
        ]),
      }),
    )
  })

  it('writes geo fields when creating a comment', async () => {
    const returning = jest.fn().mockResolvedValue([
      {
        id: 31,
        userId: 11,
        targetType: CommentTargetTypeEnum.COMIC,
        targetId: 901,
        replyToId: null,
        content: '评论内容',
        createdAt: new Date('2026-03-30T08:00:00.000Z'),
      },
    ])
    const values = jest.fn(() => ({ returning }))
    const insert = jest.fn(() => ({ values }))
    const selectWhere = jest.fn().mockResolvedValue([{ floor: 0 }])
    const selectFrom = jest.fn(() => ({ where: selectWhere }))
    const select = jest.fn(() => ({ from: selectFrom }))

    const service = await createCommentService({
      db: {
        transaction: jest.fn(async (callback) =>
          callback({
            select,
            insert,
          }),
        ),
      },
      withErrorHandling: jest.fn(async (callback) => callback()),
      isSerializationFailure: jest.fn().mockReturnValue(false),
      schema: {
        appUserComment: {
          id: 'id',
          userId: 'userId',
          targetType: 'targetType',
          targetId: 'targetId',
          replyToId: 'replyToId',
          content: 'content',
          createdAt: 'createdAt',
          floor: 'floor',
        },
        appUser: {},
      },
    } as any)

    await service.createComment(
      {
        userId: 11,
        targetType: CommentTargetTypeEnum.COMIC,
        targetId: 901,
        content: '评论内容',
      },
      {
        geoCountry: '中国',
        geoProvince: '广东省',
        geoCity: '深圳市',
        geoIsp: '电信',
        geoSource: 'ip2region',
      },
    )

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        geoCountry: '中国',
        geoProvince: '广东省',
        geoCity: '深圳市',
        geoIsp: '电信',
        geoSource: 'ip2region',
      }),
    )
  })

  it('writes geo fields when replying to a comment', async () => {
    const returning = jest.fn().mockResolvedValue([
      {
        id: 32,
        userId: 11,
        targetType: CommentTargetTypeEnum.COMIC,
        targetId: 901,
        replyToId: 77,
        content: '回复内容',
        createdAt: new Date('2026-03-30T08:10:00.000Z'),
      },
    ])
    const values = jest.fn(() => ({ returning }))
    const insert = jest.fn(() => ({ values }))

    const service = await createCommentService({
      db: {
        query: {
          appUserComment: {
            findFirst: jest.fn().mockResolvedValue({
              id: 77,
              targetType: CommentTargetTypeEnum.COMIC,
              targetId: 901,
              userId: 42,
              replyToId: null,
              actualReplyToId: null,
              deletedAt: null,
            }),
          },
        },
      },
      withTransaction: jest.fn(async (callback) =>
        callback({
          insert,
        }),
      ),
      schema: {
        appUserComment: {
          id: 'id',
          userId: 'userId',
          targetType: 'targetType',
          targetId: 'targetId',
          replyToId: 'replyToId',
          actualReplyToId: 'actualReplyToId',
          content: 'content',
          createdAt: 'createdAt',
        },
        appUser: {},
      },
    } as any)

    await service.replyComment(
      {
        userId: 11,
        replyToId: 77,
        content: '回复内容',
      },
      {
        geoCountry: '中国',
        geoProvince: '广东省',
        geoCity: '深圳市',
        geoIsp: '电信',
        geoSource: 'ip2region',
      },
    )

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        geoCountry: '中国',
        geoProvince: '广东省',
        geoCity: '深圳市',
        geoIsp: '电信',
        geoSource: 'ip2region',
      }),
    )
  })
})
