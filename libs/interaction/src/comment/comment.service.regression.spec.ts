import * as schema from '@db/schema'
import {
  AuditRoleEnum,
  AuditStatusEnum,
} from '@libs/platform/constant/audit.constant'
import { CommentTargetTypeEnum } from './comment.constant'
import { CommentService } from './comment.service'

function createUpdateChain(result: unknown) {
  const chain = {
    set: jest.fn(() => chain),
    where: jest.fn().mockResolvedValue(result),
    returning: jest.fn().mockResolvedValue(result),
  }

  return chain
}

describe('commentService regression cases', () => {
  function createService() {
    const withTransactionMock = jest.fn()
    const drizzle = {
      db: {
        transaction: withTransactionMock,
        query: {
          userComment: {
            findFirst: jest.fn(),
          },
        },
      },
      schema,
      ext: {},
      withErrorHandling: jest.fn(async (fn: () => Promise<unknown>) => fn()),
      withTransaction: withTransactionMock,
      isSerializationFailure: jest.fn().mockReturnValue(false),
      assertAffectedRows: jest.fn(
        (result: { rowCount?: number }, message: string) => {
          if ((result?.rowCount ?? 0) <= 0) {
            throw new Error(message)
          }
        },
      ),
    }

    const commentGrowthService = {
      rewardCommentCreated: jest.fn(),
    }
    const appUserCountService = {
      updateCommentCount: jest.fn(),
      updateCommentReceivedLikeCount: jest.fn(),
    }
    const mentionService = {
      buildBodyTokens: jest.fn(),
      replaceMentionsInTx: jest.fn(),
      dispatchCommentMentionsInTx: jest.fn(),
      deleteMentionsInTx: jest.fn(),
    }
    const service = new (CommentService as any)(
      { getMatchedWordsWithMetadata: jest.fn(), getMatchedWords: jest.fn() },
      { getContentReviewPolicy: jest.fn() },
      { ensureCanComment: jest.fn() },
      commentGrowthService,
      { checkStatusBatch: jest.fn() },
      { publishInTx: jest.fn() },
      { buildCommentRepliedEvent: jest.fn() },
      appUserCountService,
      drizzle,
      mentionService,
      { recordRecentUsageInTx: jest.fn() },
      { recordEntityHitsInTx: jest.fn() },
    )

    return {
      service: service as CommentService,
      drizzle,
      withTransactionMock,
      commentGrowthService,
      appUserCountService,
      mentionService,
    }
  }

  it('删除根评论会级联删除整棵回复树并返回布尔成功值', async () => {
    const {
      service,
      withTransactionMock,
      appUserCountService,
      mentionService,
    } = createService()

    const rootComment = {
      id: 1,
      userId: 10,
      targetType: CommentTargetTypeEnum.FORUM_TOPIC,
      targetId: 7,
      replyToId: null,
      actualReplyToId: null,
      createdAt: new Date('2026-04-15T00:00:00.000Z'),
      auditStatus: AuditStatusEnum.APPROVED,
      isHidden: false,
      likeCount: 2,
      deletedAt: null,
    }
    const subtreeComments = [
      rootComment,
      {
        id: 2,
        userId: 11,
        targetType: CommentTargetTypeEnum.FORUM_TOPIC,
        targetId: 7,
        replyToId: 1,
        actualReplyToId: 1,
        createdAt: new Date('2026-04-15T00:01:00.000Z'),
        auditStatus: AuditStatusEnum.APPROVED,
        isHidden: false,
        likeCount: 5,
        deletedAt: null,
      },
      {
        id: 3,
        userId: 10,
        targetType: CommentTargetTypeEnum.FORUM_TOPIC,
        targetId: 7,
        replyToId: 2,
        actualReplyToId: 1,
        createdAt: new Date('2026-04-15T00:02:00.000Z'),
        auditStatus: AuditStatusEnum.PENDING,
        isHidden: true,
        likeCount: 1,
        deletedAt: null,
      },
    ]
    const tx = {
      query: {
        userComment: {
          findFirst: jest.fn().mockResolvedValue(rootComment),
        },
      },
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn().mockResolvedValue(subtreeComments),
        })),
      })),
      update: jest
        .fn()
        .mockImplementation(() => createUpdateChain({ rowCount: 3 })),
    }

    const resolver = {
      targetType: CommentTargetTypeEnum.FORUM_TOPIC,
      ensureCanComment: jest.fn(),
      applyCountDelta: jest.fn(),
      resolveMeta: jest.fn().mockResolvedValue({
        sectionId: 9,
      }),
      postDeleteCommentHook: jest.fn(),
    }
    service.registerResolver(resolver as never)
    withTransactionMock.mockImplementation(
      async (callback: (client: any) => Promise<unknown>) => callback(tx),
    )

    const result = await service.deleteComment(1, 10)

    expect(result).toBe(true)
    expect(mentionService.deleteMentionsInTx).toHaveBeenCalledWith({
      tx,
      sourceType: 1,
      sourceIds: [1, 2, 3],
    })
    expect(appUserCountService.updateCommentCount).toHaveBeenCalledWith(
      tx,
      10,
      -2,
    )
    expect(appUserCountService.updateCommentCount).toHaveBeenCalledWith(
      tx,
      11,
      -1,
    )
    expect(
      appUserCountService.updateCommentReceivedLikeCount,
    ).toHaveBeenCalledWith(tx, 10, -3)
    expect(
      appUserCountService.updateCommentReceivedLikeCount,
    ).toHaveBeenCalledWith(tx, 11, -5)
    expect(resolver.applyCountDelta).toHaveBeenCalledWith(tx, 7, -2)
    expect(resolver.postDeleteCommentHook).toHaveBeenCalledTimes(1)
  })

  it('重复把评论审核为同一终态时应视为幂等成功且不重复发奖励', async () => {
    const { service, commentGrowthService, drizzle } = createService()

    ;(drizzle.db.query.userComment.findFirst as jest.Mock).mockResolvedValue({
      id: 11,
      userId: 9,
      targetType: CommentTargetTypeEnum.FORUM_TOPIC,
      targetId: 7,
      replyToId: null,
      content: '已审核评论',
      createdAt: new Date('2026-04-15T00:00:00.000Z'),
      auditStatus: AuditStatusEnum.APPROVED,
      isHidden: false,
      deletedAt: null,
    })

    await expect(
      service.updateCommentAuditStatus({
        id: 11,
        auditStatus: AuditStatusEnum.APPROVED,
        auditReason: null,
        auditById: 100,
        auditRole: AuditRoleEnum.ADMIN,
      }),
    ).resolves.toBe(true)

    expect(commentGrowthService.rewardCommentCreated).not.toHaveBeenCalled()
  })

  it('重复设置评论隐藏状态为同一值时应视为幂等成功且不重复发奖励', async () => {
    const { service, commentGrowthService, drizzle } = createService()

    ;(drizzle.db.query.userComment.findFirst as jest.Mock).mockResolvedValue({
      id: 12,
      userId: 9,
      targetType: CommentTargetTypeEnum.FORUM_TOPIC,
      targetId: 7,
      replyToId: null,
      content: '已隐藏评论',
      createdAt: new Date('2026-04-15T00:00:00.000Z'),
      auditStatus: AuditStatusEnum.APPROVED,
      isHidden: true,
      deletedAt: null,
    })

    await expect(
      service.updateCommentHidden({
        id: 12,
        isHidden: true,
      }),
    ).resolves.toBe(true)

    expect(commentGrowthService.rewardCommentCreated).not.toHaveBeenCalled()
  })
})
