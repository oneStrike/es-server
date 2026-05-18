/// <reference types="jest" />

import { AuditRoleEnum, AuditStatusEnum } from '@libs/platform/constant'
import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { ForumModeratorActionTypeEnum } from './moderator-action-log.constant'
import {
  ForumModeratorPermissionEnum,
  ForumModeratorRoleTypeEnum,
} from './moderator.constant'
import { ForumModeratorGovernanceService } from './moderator-governance.service'

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
    updateTopicPinned: jest.fn(async () => true),
    updateTopicPinnedInTx: jest.fn(async () => true),
  }
  const commentService = {
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
  const service = new ForumModeratorGovernanceService(
    drizzle as any,
    moderatorService as any,
    topicService as any,
    commentService as any,
    actionLogService as any,
  )

  return {
    actionLogService,
    commentService,
    db,
    drizzle,
    moderatorService,
    service,
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
