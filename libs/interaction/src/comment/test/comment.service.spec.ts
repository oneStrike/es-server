import { EventEnvelopeGovernanceStatusEnum } from '@libs/growth/event-definition/event-envelope.type';
import { AuditRoleEnum, AuditStatusEnum } from '@libs/platform/constant/audit.constant';
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
  EmojiParserService: class {}
}))

jest.mock('../../emoji/emoji.constant', () => ({
  EmojiSceneEnum: {
    COMMENT: 'COMMENT',
  }
}))

jest.mock('../../like/like.service', () => ({
  LikeService: class {},
}))

jest.mock('@libs/message/outbox/outbox.service', () => ({
  MessageOutboxService: class {}
}))

jest.mock('@libs/message/notification/notification-composer.service', () => ({
  MessageNotificationComposerService: class {}
}))

jest.mock('@libs/sensitive-word/sensitive-word-detect.service', () => ({
  SensitiveWordDetectService: class {}
}))

jest.mock('@libs/sensitive-word/sensitive-word-constant', () => ({
  SensitiveWordLevelEnum: {
    LIGHT: 1,
    GENERAL: 2,
    SEVERE: 3,
  }
}))

jest.mock('@libs/system-config/config-reader', () => ({
  ConfigReader: class {}
}))

jest.mock('@libs/user', () => ({
  AppUserCountService: class {},
}))

describe('comment admin moderation flow', () => {
  const commentTable = {
    id: 'id',
    deletedAt: 'deletedAt',
    targetType: 'targetType',
    targetId: 'targetId',
    userId: 'userId',
    replyToId: 'replyToId',
    actualReplyToId: 'actualReplyToId',
    content: 'content',
    auditStatus: 'auditStatus',
    isHidden: 'isHidden',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    auditReason: 'auditReason',
    auditById: 'auditById',
    auditRole: 'auditRole',
    auditAt: 'auditAt',
  }

  async function createService(options: {
    currentComment: {
      id: number
      userId: number
      targetType: CommentTargetTypeEnum
      targetId: number
      replyToId?: number | null
      content: string
      createdAt: Date
      auditStatus: AuditStatusEnum
      isHidden: boolean
      deletedAt: Date | null
    }
    txReplyTarget?: { userId: number } | null
  }) {
    const rewardCommentCreated = jest.fn().mockResolvedValue(undefined)
    const enqueueNotificationEventInTx = jest
      .fn()
      .mockResolvedValue(undefined)
    const buildCommentReplyEvent = jest.fn((input) => ({
      bizKey: input.bizKey,
      payload: {
        receiverUserId: input.receiverUserId,
        actorUserId: input.actorUserId,
        subjectId: input.subjectId,
        targetId: input.targetId,
        payload: input.payload,
      },
    }))
    const applyCountDelta = jest.fn().mockResolvedValue(undefined)
    const resolveMeta = jest.fn().mockResolvedValue({
      ownerUserId: 99,
      targetDisplayTitle: '进击的巨人：前三卷伏笔整理',
    })
    const postCommentHook = jest.fn().mockResolvedValue(undefined)
    const postDeleteCommentHook = jest.fn().mockResolvedValue(undefined)
    const assertAffectedRows = jest.fn()
    const withErrorHandling = jest.fn(async (callback) => callback())
    const dbFindFirst = jest.fn().mockResolvedValue(options.currentComment)
    const txFindFirst = jest.fn().mockResolvedValue(options.txReplyTarget ?? null)
    const txActorFindFirst = jest.fn().mockResolvedValue({ nickname: '小光' })
    const where = jest.fn().mockResolvedValue({ rowCount: 1 })
    const set = jest.fn(() => ({ where }))
    const update = jest.fn(() => ({ set }))
    const transaction = jest.fn(async (callback) =>
      callback({
        query: {
          userComment: {
            findFirst: txFindFirst,
          },
          appUser: {
            findFirst: txActorFindFirst,
          },
        },
        update,
      } as any),
    )

    const drizzle = {
      db: {
        query: {
          userComment: {
            findFirst: dbFindFirst,
          },
        },
        transaction,
      },
      schema: {
        userComment: commentTable,
        appUser: {
          id: 'id',
          nickname: 'nickname',
          avatarUrl: 'avatarUrl',
          isEnabled: 'isEnabled',
          status: 'status',
        },
      },
      withErrorHandling,
      assertAffectedRows,
    }

    const { CommentService } = await import('../comment.service')

    const service = new CommentService(
      {} as any,
      {} as any,
      {} as any,
      { rewardCommentCreated } as any,
      {} as any,
      { enqueueNotificationEventInTx } as any,
      { buildCommentReplyEvent } as any,
      {} as any,
      {} as any,
      drizzle as any,
    )

    service.registerResolver({
      targetType: CommentTargetTypeEnum.COMIC,
      ensureCanComment: jest.fn(),
      applyCountDelta,
      resolveMeta,
      postCommentHook,
      postDeleteCommentHook,
    } as any)

    return {
      service,
      mocks: {
        rewardCommentCreated,
        enqueueNotificationEventInTx,
        buildCommentReplyEvent,
        applyCountDelta,
        resolveMeta,
        postCommentHook,
        postDeleteCommentHook,
        dbFindFirst,
        txFindFirst,
        txActorFindFirst,
        update,
        set,
        where,
        transaction,
        assertAffectedRows,
        withErrorHandling,
      },
    }
  }

  it('backfills reward and reply notification when a pending reply comment is approved', async () => {
    const createdAt = new Date('2026-03-29T12:00:00.000Z')
    const { service, mocks } = await createService({
      currentComment: {
        id: 31,
        userId: 11,
        targetType: CommentTargetTypeEnum.COMIC,
        targetId: 901,
        replyToId: 77,
        content: '而且艾伦和调查兵团的立场差异很早就有预警。',
        createdAt,
        auditStatus: AuditStatusEnum.PENDING,
        isHidden: false,
        deletedAt: null,
      },
      txReplyTarget: {
        userId: 42,
      },
    })

    await expect(
      service.updateCommentAuditStatus({
        id: 31,
        auditStatus: AuditStatusEnum.APPROVED,
        auditReason: '审核通过',
        auditById: 7,
        auditRole: AuditRoleEnum.ADMIN,
      }),
    ).resolves.toBe(true)

    expect(mocks.applyCountDelta).toHaveBeenCalledWith(
      expect.anything(),
      901,
      1,
    )
    expect(mocks.postCommentHook).toHaveBeenCalledWith(
      expect.anything(),
      {
        id: 31,
        userId: 11,
        targetType: CommentTargetTypeEnum.COMIC,
        targetId: 901,
        replyToId: 77,
        content: '而且艾伦和调查兵团的立场差异很早就有预警。',
        createdAt,
        replyTargetUserId: undefined,
      },
      expect.objectContaining({ ownerUserId: 99 }),
    )
    expect(mocks.enqueueNotificationEventInTx).toHaveBeenCalledWith(
      expect.anything(),
      {
        bizKey: 'comment:reply:31:to:42',
        payload: {
          receiverUserId: 42,
          actorUserId: 11,
          subjectId: 31,
          targetId: 901,
          payload: {
            actorNickname: '小光',
            replyExcerpt: '而且艾伦和调查兵团的立场差异很早就有预警。',
            targetDisplayTitle: '进击的巨人：前三卷伏笔整理',
          },
        },
      },
    )
    expect(mocks.buildCommentReplyEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        receiverUserId: 42,
        actorUserId: 11,
        subjectId: 31,
        targetId: 901,
        payload: {
          actorNickname: '小光',
          replyExcerpt: '而且艾伦和调查兵团的立场差异很早就有预警。',
          targetDisplayTitle: '进击的巨人：前三卷伏笔整理',
        },
      }),
    )
    expect(mocks.txFindFirst).toHaveBeenCalledTimes(1)
    expect(mocks.rewardCommentCreated).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 11,
        id: 31,
        targetType: CommentTargetTypeEnum.COMIC,
        targetId: 901,
        occurredAt: createdAt,
        eventEnvelope: expect.objectContaining({
          governanceStatus: EventEnvelopeGovernanceStatusEnum.PASSED,
          context: expect.objectContaining({
            replyToId: 77,
            auditStatus: AuditStatusEnum.APPROVED,
            isHidden: false,
          }),
        }),
      }),
    )
  })

  it('does not duplicate reward when a visible comment is re-approved', async () => {
    const { service, mocks } = await createService({
      currentComment: {
        id: 32,
        userId: 12,
        targetType: CommentTargetTypeEnum.COMIC,
        targetId: 902,
        replyToId: null,
        content: '普通评论内容',
        createdAt: new Date('2026-03-29T12:10:00.000Z'),
        auditStatus: AuditStatusEnum.APPROVED,
        isHidden: false,
        deletedAt: null,
      },
    })

    await expect(
      service.updateCommentAuditStatus({
        id: 32,
        auditStatus: AuditStatusEnum.APPROVED,
        auditReason: '复核通过',
        auditById: 7,
      }),
    ).resolves.toBe(true)

    expect(mocks.applyCountDelta).not.toHaveBeenCalled()
    expect(mocks.resolveMeta).not.toHaveBeenCalled()
    expect(mocks.postCommentHook).not.toHaveBeenCalled()
    expect(mocks.enqueueNotificationEventInTx).not.toHaveBeenCalled()
    expect(mocks.rewardCommentCreated).not.toHaveBeenCalled()
  })

  it('rolls back visible comment counters when an approved comment is hidden', async () => {
    const createdAt = new Date('2026-03-29T12:20:00.000Z')
    const { service, mocks } = await createService({
      currentComment: {
        id: 33,
        userId: 13,
        targetType: CommentTargetTypeEnum.COMIC,
        targetId: 903,
        replyToId: null,
        content: '隐藏前评论内容',
        createdAt,
        auditStatus: AuditStatusEnum.APPROVED,
        isHidden: false,
        deletedAt: null,
      },
    })

    await expect(
      service.updateCommentHidden({
        id: 33,
        isHidden: true,
      }),
    ).resolves.toBe(true)

    expect(mocks.applyCountDelta).toHaveBeenCalledWith(
      expect.anything(),
      903,
      -1,
    )
    expect(mocks.postDeleteCommentHook).toHaveBeenCalledWith(
      expect.anything(),
      {
        id: 33,
        userId: 13,
        targetType: CommentTargetTypeEnum.COMIC,
        targetId: 903,
        replyToId: null,
        content: '隐藏前评论内容',
        createdAt,
        replyTargetUserId: undefined,
      },
      expect.objectContaining({ ownerUserId: 99 }),
    )
    expect(mocks.rewardCommentCreated).not.toHaveBeenCalled()
  })

  it('backfills reward when an approved hidden comment is unhidden for the first time', async () => {
    const createdAt = new Date('2026-03-29T12:30:00.000Z')
    const { service, mocks } = await createService({
      currentComment: {
        id: 34,
        userId: 14,
        targetType: CommentTargetTypeEnum.COMIC,
        targetId: 904,
        replyToId: null,
        content: '取消隐藏评论内容',
        createdAt,
        auditStatus: AuditStatusEnum.APPROVED,
        isHidden: true,
        deletedAt: null,
      },
    })

    await expect(
      service.updateCommentHidden({
        id: 34,
        isHidden: false,
      }),
    ).resolves.toBe(true)

    expect(mocks.applyCountDelta).toHaveBeenCalledWith(
      expect.anything(),
      904,
      1,
    )
    expect(mocks.rewardCommentCreated).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 14,
        id: 34,
        targetId: 904,
        eventEnvelope: expect.objectContaining({
          governanceStatus: EventEnvelopeGovernanceStatusEnum.PASSED,
          context: expect.objectContaining({
            auditStatus: AuditStatusEnum.APPROVED,
            isHidden: false,
          }),
        }),
      }),
    )
  })
})
