import { EventEnvelopeGovernanceStatusEnum } from '@libs/growth/event-definition'
import { AuditStatusEnum } from '@libs/platform/constant'
import { CommentTargetTypeEnum } from '../comment.constant'

jest.mock('@db/core', () => ({
  DrizzleService: class {},
  escapeLikePattern: (value: string) => value,
}))

jest.mock('../../emoji', () => ({
  EmojiParserService: class {},
  EmojiSceneEnum: {
    COMMENT: 'COMMENT',
  },
}))

jest.mock('../../like/like.service', () => ({
  LikeService: class {},
}))

jest.mock('@libs/message/outbox', () => ({
  MessageOutboxService: class {},
}))

jest.mock('@libs/message/notification', () => ({
  MessageNotificationComposerService: class {},
}))

jest.mock('@libs/sensitive-word', () => ({
  SensitiveWordDetectService: class {},
  SensitiveWordLevelEnum: {
    LIGHT: 1,
    GENERAL: 2,
    SEVERE: 3,
  },
}))

jest.mock('@libs/system-config', () => ({
  ConfigReader: class {},
}))

jest.mock('@libs/user/core', () => ({
  AppUserCountService: class {},
}))

describe('comment reply notification flow', () => {
  it('reuses reply target user from replyComment prefetch instead of querying it again in compensation', async () => {
    const createdAt = new Date('2026-03-30T08:00:00.000Z')
    const dbReplyToFindFirst = jest.fn().mockResolvedValue({
      id: 77,
      targetType: CommentTargetTypeEnum.COMIC,
      targetId: 901,
      userId: 42,
      replyToId: null,
      actualReplyToId: null,
      deletedAt: null,
    })
    const txReplyTargetFindFirst = jest.fn()
    const txActorFindFirst = jest.fn().mockResolvedValue({
      nickname: '小光',
    })
    const returning = jest.fn().mockResolvedValue([
      {
        id: 31,
        userId: 11,
        targetType: CommentTargetTypeEnum.COMIC,
        targetId: 901,
        replyToId: 77,
        content: '  第一卷的伏笔其实很早就埋下了。  ',
        createdAt,
      },
    ])
    const values = jest.fn(() => ({ returning }))
    const insert = jest.fn(() => ({ values }))
    const applyCountDelta = jest.fn().mockResolvedValue(undefined)
    const postCommentHook = jest.fn().mockResolvedValue(undefined)
    const resolveMeta = jest.fn().mockResolvedValue({
      ownerUserId: 99,
      targetDisplayTitle: '进击的巨人：前三卷伏笔整理',
    })
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
    const enqueueNotificationEventInTx = jest.fn().mockResolvedValue(undefined)
    const rewardCommentCreated = jest.fn().mockResolvedValue(undefined)

    const { CommentService } = await import('../comment.service')

    const service = new CommentService(
      {
        getMatchedWords: jest.fn().mockReturnValue({
          highestLevel: undefined,
          hits: [],
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
        rewardCommentCreated,
      } as any,
      {} as any,
      {
        enqueueNotificationEventInTx,
      } as any,
      {
        buildCommentReplyEvent,
      } as any,
      {
        updateCommentCount: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        parse: jest.fn().mockResolvedValue([]),
      } as any,
      {
        db: {
          query: {
            userComment: {
              findFirst: dbReplyToFindFirst,
            },
          },
        },
        schema: {
          userComment: {
            id: 'id',
            userId: 'userId',
            targetType: 'targetType',
            targetId: 'targetId',
            replyToId: 'replyToId',
            content: 'content',
            createdAt: 'createdAt',
          },
          appUser: {
            id: 'id',
          },
        },
        withTransaction: jest.fn(async (callback) =>
          callback({
            query: {
              userComment: {
                findFirst: txReplyTargetFindFirst,
              },
              appUser: {
                findFirst: txActorFindFirst,
              },
            },
            insert,
          }),
        ),
      } as any,
    )

    service.registerResolver({
      targetType: CommentTargetTypeEnum.COMIC,
      ensureCanComment: jest.fn().mockResolvedValue(undefined),
      applyCountDelta,
      resolveMeta,
      postCommentHook,
    } as any)

    await expect(
      service.replyComment({
        userId: 11,
        replyToId: 77,
        content: '  第一卷的伏笔其实很早就埋下了。  ',
      }),
    ).resolves.toEqual({ id: 31 })

    expect(txReplyTargetFindFirst).not.toHaveBeenCalled()
    expect(postCommentHook).toHaveBeenCalledWith(
      expect.anything(),
      {
        id: 31,
        userId: 11,
        targetType: CommentTargetTypeEnum.COMIC,
        targetId: 901,
        replyToId: 77,
        content: '  第一卷的伏笔其实很早就埋下了。  ',
        createdAt,
        replyTargetUserId: 42,
      },
      expect.objectContaining({
        ownerUserId: 99,
        targetDisplayTitle: '进击的巨人：前三卷伏笔整理',
      }),
    )
    expect(buildCommentReplyEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        receiverUserId: 42,
        actorUserId: 11,
        subjectId: 31,
        targetId: 901,
        payload: {
          actorNickname: '小光',
          replyExcerpt: '  第一卷的伏笔其实很早就埋下了。  ',
          targetDisplayTitle: '进击的巨人：前三卷伏笔整理',
        },
      }),
    )
    expect(enqueueNotificationEventInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        bizKey: 'comment:reply:31:to:42',
      }),
    )
    expect(rewardCommentCreated).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 11,
        id: 31,
        targetId: 901,
        occurredAt: createdAt,
        eventEnvelope: expect.objectContaining({
          governanceStatus: EventEnvelopeGovernanceStatusEnum.PASSED,
          context: expect.objectContaining({
            replyToId: 77,
          }),
        }),
      }),
    )
  })
})
