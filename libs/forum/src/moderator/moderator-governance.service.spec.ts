/// <reference types="jest" />

import { AuditRoleEnum, AuditStatusEnum } from '@libs/platform/constant'
import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { ForumModeratorActionTypeEnum } from './moderator-action-log.constant'
import {
  ForumModeratorPermissionEnum,
  ForumModeratorRoleTypeEnum,
} from './moderator.constant'
import { ForumModeratorGovernanceService } from './moderator-governance.service'

type GovernanceServiceDependencies = ConstructorParameters<
  typeof ForumModeratorGovernanceService
>

function createGovernanceService() {
  const tx = { tag: 'tx' }
  const db = {
    query: {
      forumTopic: {
        findFirst: jest.fn(async () => ({
          auditReason: null,
          auditStatus: AuditStatusEnum.PENDING,
          id: 11,
          isFeatured: false,
          isHidden: false,
          isLocked: false,
          isPinned: false,
          sectionId: 3,
          title: 'topic',
          userId: 7,
        })),
      },
      userComment: {
        findFirst: jest.fn(async () => ({
          auditReason: null,
          auditStatus: AuditStatusEnum.PENDING,
          id: 21,
          isHidden: false,
          replyToId: null,
          targetId: 11,
          targetType: CommentTargetTypeEnum.FORUM_TOPIC,
        })),
      },
    },
  }
  const drizzle = {
    db,
    schema: {
      forumTopic: {},
      userComment: {},
    },
    withTransaction: jest.fn(async (callback: (runner: typeof tx) => unknown) =>
      callback(tx),
    ),
  }
  const moderatorService = {
    ensureModeratorPermissionForSection: jest.fn(async () => ({
      grantedPermissions: [ForumModeratorPermissionEnum.PIN],
      moderatorId: 5,
      moderatorUserId: 100,
      roleType: ForumModeratorRoleTypeEnum.SECTION,
      sectionId: 3,
    })),
  }
  const topicService = {
    buildApprovedTopicGrowthEventPayload: jest.fn(() => null),
    deleteTopicWithCurrentInTx: jest.fn(async () => true),
    getActiveTopicByIdInTx: jest.fn(async () => ({
      favoriteCount: 0,
      id: 11,
      likeCount: 0,
      sectionId: 3,
      userId: 7,
    })),
    moveTopicInTx: jest.fn(async () => true),
    rewardApprovedTopicIfNeeded: jest.fn(async () => undefined),
    updateTopic: jest.fn(async (_input, _context, _actorUserId, options) => {
      await options?.afterUpdateInTx?.(tx, {
        auditStatus: AuditStatusEnum.APPROVED,
        id: 11,
        isHidden: false,
        sectionId: 3,
        title: 'topic next',
        userId: 7,
      })
      return true
    }),
    updateTopicPinned: jest.fn(async () => true),
    updateTopicPinnedInTx: jest.fn(async () => true),
  }
  const commentService = {
    buildCommentCreatedGrowthEventPayload: jest.fn(() => null),
    buildVisibleCommentGrowthEventPayload: jest.fn(() => null),
    deleteCommentInTx: jest.fn(async () => true),
    rewardCommentModerationIfNeeded: jest.fn(async () => undefined),
    updateCommentHidden: jest.fn(async () => true),
    updateCommentAuditStatusInTx: jest.fn(async () => ({
      changed: true,
      eventEnvelope: null,
      rewardComment: null,
    })),
    updateCommentHiddenInTx: jest.fn(async () => ({
      changed: true,
      eventEnvelope: null,
      rewardComment: null,
    })),
  }
  const actionLogService = {
    createActionLog: jest.fn(async () => true),
    createActionLogInTx: jest.fn(async () => true),
  }
  const growthRewardSettlementService = {
    ensureGrowthEventSettlement: jest.fn(async () => ({ id: 1 })),
  }
  const service = new ForumModeratorGovernanceService(
    drizzle as unknown as GovernanceServiceDependencies[0],
    moderatorService as unknown as GovernanceServiceDependencies[1],
    topicService as unknown as GovernanceServiceDependencies[2],
    commentService as unknown as GovernanceServiceDependencies[3],
    actionLogService as unknown as GovernanceServiceDependencies[4],
    growthRewardSettlementService as unknown as GovernanceServiceDependencies[5],
  )

  return {
    actionLogService,
    commentService,
    db,
    drizzle,
    moderatorService,
    service,
    growthRewardSettlementService,
    topicService,
    tx,
  }
}

describe('ForumModeratorGovernanceService transaction boundary', () => {
  it('updates topic state and writes moderator action log in one transaction', async () => {
    const { actionLogService, drizzle, service, topicService, tx } =
      createGovernanceService()

    await service.updateTopicPinned(
      { id: 11, isPinned: true },
      { actorType: 'moderator', actorUserId: 100 },
    )

    expect(drizzle.withTransaction).toHaveBeenCalledTimes(1)
    expect(topicService.updateTopicPinnedInTx).toHaveBeenCalledWith(tx, {
      id: 11,
      isPinned: true,
    })
    expect(actionLogService.createActionLogInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        actionType: ForumModeratorActionTypeEnum.PIN_TOPIC,
        moderatorId: 5,
        targetId: 11,
      }),
    )
  })

  it('writes admin topic governance into the shared action log with nullable moderator id', async () => {
    const { actionLogService, service, tx } = createGovernanceService()

    await service.updateTopicPinned(
      { id: 11, isPinned: true },
      { actorType: 'admin', actorUserId: 9001 },
    )

    expect(actionLogService.createActionLogInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        actorType: 'admin',
        actorUserId: 9001,
        moderatorId: null,
        targetId: 11,
      }),
    )
  })

  it('updates admin topic content through governance without writing user action logs', async () => {
    const { actionLogService, service, topicService, tx } =
      createGovernanceService()

    await service.updateTopicContent(
      { html: '<p>next</p>', id: 11, title: 'topic next' },
      { actorType: 'admin', actorUserId: 9001 },
    )

    expect(topicService.updateTopic).toHaveBeenCalledWith(
      { html: '<p>next</p>', id: 11, title: 'topic next' },
      {},
      9001,
      expect.objectContaining({
        recordUserActionLog: false,
      }),
    )
    expect(actionLogService.createActionLogInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        actionType: ForumModeratorActionTypeEnum.UPDATE_TOPIC,
        actorType: 'admin',
        actorUserId: 9001,
        moderatorId: null,
        targetId: 11,
      }),
    )
  })

  it('propagates moderator action log failures instead of treating mutation as successful', async () => {
    const { actionLogService, service } = createGovernanceService()
    actionLogService.createActionLogInTx.mockRejectedValueOnce(
      new Error('log failed'),
    )

    await expect(
      service.updateTopicPinned(
        { id: 11, isPinned: true },
        { actorType: 'moderator', actorUserId: 100 },
      ),
    ).rejects.toThrow('log failed')
  })

  it('skips both mutation and log for no-op topic status governance', async () => {
    const { actionLogService, drizzle, service, topicService } =
      createGovernanceService()

    await service.updateTopicPinned(
      { id: 11, isPinned: false },
      { actorType: 'moderator', actorUserId: 100 },
    )

    expect(drizzle.withTransaction).not.toHaveBeenCalled()
    expect(topicService.updateTopicPinnedInTx).not.toHaveBeenCalled()
    expect(actionLogService.createActionLogInTx).not.toHaveBeenCalled()
  })

  it('updates comment state and writes moderator action log in one transaction', async () => {
    const { actionLogService, commentService, service, tx } =
      createGovernanceService()

    await service.updateCommentHidden(
      { id: 21, isHidden: true },
      { actorType: 'moderator', actorUserId: 100 },
    )

    expect(commentService.updateCommentHiddenInTx).toHaveBeenCalledWith(tx, {
      id: 21,
      isHidden: true,
    })
    expect(actionLogService.createActionLogInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        actionType: ForumModeratorActionTypeEnum.HIDE_COMMENT,
        moderatorId: 5,
        targetId: 21,
      }),
    )
  })

  it('deletes admin comments through the governance action log', async () => {
    const { actionLogService, commentService, service, tx } =
      createGovernanceService()

    await service.deleteComment(
      { id: 21 },
      { actorType: 'admin', actorUserId: 9001 },
    )

    expect(commentService.deleteCommentInTx).toHaveBeenCalledWith(tx, 21)
    expect(actionLogService.createActionLogInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        actionType: ForumModeratorActionTypeEnum.DELETE_COMMENT,
        actorType: 'admin',
        actorUserId: 9001,
        moderatorId: null,
        targetId: 21,
      }),
    )
  })

  it('skips moderator action log when comment hidden update is a transaction-local no-op', async () => {
    const { actionLogService, commentService, service, tx } =
      createGovernanceService()
    commentService.updateCommentHiddenInTx.mockResolvedValueOnce({
      changed: false,
      eventEnvelope: null,
      rewardComment: null,
    })

    await service.updateCommentHidden(
      { id: 21, isHidden: true },
      { actorType: 'moderator', actorUserId: 100 },
    )

    expect(commentService.updateCommentHiddenInTx).toHaveBeenCalledWith(tx, {
      id: 21,
      isHidden: true,
    })
    expect(actionLogService.createActionLogInTx).not.toHaveBeenCalled()
    expect(commentService.rewardCommentModerationIfNeeded).toHaveBeenCalledWith(
      {
        changed: false,
        eventEnvelope: null,
        rewardComment: null,
      },
    )
  })

  it('skips moderator action log when comment audit update is a transaction-local no-op', async () => {
    const { actionLogService, commentService, service, tx } =
      createGovernanceService()
    commentService.updateCommentAuditStatusInTx.mockResolvedValueOnce({
      changed: false,
      eventEnvelope: null,
      rewardComment: null,
    })

    await service.updateCommentAuditStatus(
      { auditReason: 'pass', auditStatus: AuditStatusEnum.APPROVED, id: 21 },
      { actorType: 'moderator', actorUserId: 100 },
    )

    expect(commentService.updateCommentAuditStatusInTx).toHaveBeenCalledWith(
      tx,
      {
        auditById: 100,
        auditReason: 'pass',
        auditRole: AuditRoleEnum.MODERATOR,
        auditStatus: AuditStatusEnum.APPROVED,
        id: 21,
      },
    )
    expect(actionLogService.createActionLogInTx).not.toHaveBeenCalled()
    expect(commentService.rewardCommentModerationIfNeeded).toHaveBeenCalledWith(
      {
        changed: false,
        eventEnvelope: null,
        rewardComment: null,
      },
    )
  })
})
