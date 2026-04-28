import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { AuditRoleEnum, AuditStatusEnum, BusinessErrorCode } from '@libs/platform/constant'
import { ForumModeratorActionTargetTypeEnum, ForumModeratorActionTypeEnum } from './moderator-action-log.constant'
import { ForumModeratorGovernanceService } from './moderator-governance.service'
import { ForumModeratorPermissionEnum, ForumModeratorRoleTypeEnum } from './moderator.constant'

describe('ForumModeratorGovernanceService', () => {
  function createService() {
    const forumTopicFindFirst = jest.fn()
    const userCommentFindFirst = jest.fn()
    const moderatorService = {
      ensureModeratorPermissionForSection: jest.fn().mockResolvedValue({
        moderatorId: 9,
        moderatorUserId: 7,
        roleType: ForumModeratorRoleTypeEnum.SECTION,
        sectionId: 2,
        grantedPermissions: [ForumModeratorPermissionEnum.PIN],
      }),
    }
    const forumTopicService = {
      updateTopicPinned: jest.fn().mockResolvedValue(true),
      updateTopicFeatured: jest.fn().mockResolvedValue(true),
      updateTopicLocked: jest.fn().mockResolvedValue(true),
      deleteTopic: jest.fn().mockResolvedValue(true),
      moveTopic: jest.fn().mockResolvedValue(true),
      updateTopicHidden: jest.fn().mockResolvedValue(true),
      updateTopicAuditStatus: jest.fn().mockResolvedValue(true),
    }
    const commentService = {
      deleteComment: jest.fn().mockResolvedValue(true),
      updateCommentHidden: jest.fn().mockResolvedValue(true),
      updateCommentAuditStatus: jest.fn().mockResolvedValue(true),
    }
    const forumModeratorActionLogService = {
      createActionLog: jest.fn().mockResolvedValue(true),
    }

    const service = new ForumModeratorGovernanceService(
      {
        db: {
          query: {
            forumTopic: {
              findFirst: forumTopicFindFirst,
            },
            userComment: {
              findFirst: userCommentFindFirst,
            },
          },
        },
      } as never,
      moderatorService as never,
      forumTopicService as never,
      commentService as never,
      forumModeratorActionLogService as never,
    )

    return {
      service,
      forumTopicFindFirst,
      userCommentFindFirst,
      moderatorService,
      forumTopicService,
      commentService,
      forumModeratorActionLogService,
    }
  }

  it('checks PIN permission and writes moderator topic log when pinning a topic', async () => {
    const {
      service,
      forumModeratorActionLogService,
      forumTopicFindFirst,
      forumTopicService,
      moderatorService,
    } = createService()
    forumTopicFindFirst.mockResolvedValue({
      id: 1,
      sectionId: 2,
      userId: 5,
      title: '待置顶主题',
      isPinned: false,
      isFeatured: false,
      isLocked: false,
      isHidden: false,
      auditStatus: AuditStatusEnum.APPROVED,
      auditReason: null,
    })

    await service.updateTopicPinned(
      { id: 1, isPinned: true },
      { actorType: 'moderator', actorUserId: 7 },
    )

    expect(
      moderatorService.ensureModeratorPermissionForSection,
    ).toHaveBeenCalledWith(7, 2, ForumModeratorPermissionEnum.PIN)
    expect(forumTopicService.updateTopicPinned).toHaveBeenCalledWith({
      id: 1,
      isPinned: true,
    })
    expect(forumModeratorActionLogService.createActionLog).toHaveBeenCalledWith({
      moderatorId: 9,
      targetId: 1,
      actionType: ForumModeratorActionTypeEnum.PIN_TOPIC,
      targetType: ForumModeratorActionTargetTypeEnum.TOPIC,
      actionDescription: '置顶主题',
      beforeData: { isPinned: false },
      afterData: { isPinned: true },
    })
  })

  it('skips moderator permission and action log for admin feature updates', async () => {
    const {
      service,
      forumModeratorActionLogService,
      forumTopicFindFirst,
      forumTopicService,
      moderatorService,
    } = createService()
    forumTopicFindFirst.mockResolvedValue({
      id: 1,
      sectionId: 2,
      userId: 5,
      title: '待加精主题',
      isPinned: false,
      isFeatured: false,
      isLocked: false,
      isHidden: false,
      auditStatus: AuditStatusEnum.APPROVED,
      auditReason: null,
    })

    await service.updateTopicFeatured(
      { id: 1, isFeatured: true },
      { actorType: 'admin', actorUserId: 99 },
    )

    expect(
      moderatorService.ensureModeratorPermissionForSection,
    ).not.toHaveBeenCalled()
    expect(forumTopicService.updateTopicFeatured).toHaveBeenCalledWith({
      id: 1,
      isFeatured: true,
    })
    expect(forumModeratorActionLogService.createActionLog).not.toHaveBeenCalled()
  })

  it('passes moderator audit identity into topic audit updates', async () => {
    const {
      service,
      forumTopicFindFirst,
      forumTopicService,
      moderatorService,
    } = createService()
    forumTopicFindFirst.mockResolvedValue({
      id: 3,
      sectionId: 5,
      userId: 9,
      title: '待审核主题',
      isPinned: false,
      isFeatured: false,
      isLocked: false,
      isHidden: false,
      auditStatus: AuditStatusEnum.PENDING,
      auditReason: null,
    })
    moderatorService.ensureModeratorPermissionForSection.mockResolvedValue({
      moderatorId: 12,
      moderatorUserId: 7,
      roleType: ForumModeratorRoleTypeEnum.SECTION,
      sectionId: 5,
      grantedPermissions: [ForumModeratorPermissionEnum.AUDIT],
    })

    await service.updateTopicAuditStatus(
      {
        id: 3,
        auditStatus: AuditStatusEnum.APPROVED,
        auditReason: '审核通过',
      },
      { actorType: 'moderator', actorUserId: 7 },
    )

    expect(forumTopicService.updateTopicAuditStatus).toHaveBeenCalledWith(
      {
        id: 3,
        auditStatus: AuditStatusEnum.APPROVED,
        auditReason: '审核通过',
      },
      {
        auditById: 7,
        auditRole: AuditRoleEnum.MODERATOR,
      },
    )
  })

  it('rejects non-forum comments before moderator governance continues', async () => {
    const { service, userCommentFindFirst } = createService()
    userCommentFindFirst.mockResolvedValue({
      id: 8,
      targetType: CommentTargetTypeEnum.COMIC,
      targetId: 11,
      replyToId: null,
      isHidden: false,
      auditStatus: AuditStatusEnum.PENDING,
      auditReason: null,
    })

    await expect(
      service.updateCommentHidden(
        { id: 8, isHidden: true },
        { actorType: 'moderator', actorUserId: 7 },
      ),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
    })
  })

  it('allows admin governance on non-forum comments without moderator scope checks', async () => {
    const {
      service,
      commentService,
      forumTopicFindFirst,
      moderatorService,
      userCommentFindFirst,
    } = createService()
    userCommentFindFirst.mockResolvedValue({
      id: 18,
      targetType: CommentTargetTypeEnum.COMIC,
      targetId: 11,
      replyToId: null,
      isHidden: false,
      auditStatus: AuditStatusEnum.PENDING,
      auditReason: null,
    })

    await expect(
      service.updateCommentHidden(
        { id: 18, isHidden: true },
        { actorType: 'admin', actorUserId: 99 },
      ),
    ).resolves.toBe(true)

    expect(commentService.updateCommentHidden).toHaveBeenCalledWith({
      id: 18,
      isHidden: true,
    })
    expect(
      moderatorService.ensureModeratorPermissionForSection,
    ).not.toHaveBeenCalled()
    expect(forumTopicFindFirst).not.toHaveBeenCalled()
  })

  it('uses DELETE permission and forwards actor identity when deleting a topic', async () => {
    const {
      service,
      forumModeratorActionLogService,
      forumTopicFindFirst,
      forumTopicService,
      moderatorService,
    } = createService()
    forumTopicFindFirst.mockResolvedValue({
      id: 11,
      sectionId: 4,
      userId: 6,
      title: '待删除主题',
      isPinned: false,
      isFeatured: false,
      isLocked: false,
      isHidden: false,
      auditStatus: AuditStatusEnum.APPROVED,
      auditReason: null,
    })
    moderatorService.ensureModeratorPermissionForSection.mockResolvedValue({
      moderatorId: 9,
      moderatorUserId: 7,
      roleType: ForumModeratorRoleTypeEnum.SECTION,
      sectionId: 4,
      grantedPermissions: [ForumModeratorPermissionEnum.DELETE],
    })

    await service.deleteTopic(
      { id: 11 },
      { actorType: 'moderator', actorUserId: 7 },
    )

    expect(
      moderatorService.ensureModeratorPermissionForSection,
    ).toHaveBeenCalledWith(7, 4, ForumModeratorPermissionEnum.DELETE)
    expect(forumTopicService.deleteTopic).toHaveBeenCalledWith(11, {}, 7)
    expect(forumModeratorActionLogService.createActionLog).toHaveBeenCalledWith({
      moderatorId: 9,
      targetId: 11,
      actionType: ForumModeratorActionTypeEnum.DELETE_TOPIC,
      targetType: ForumModeratorActionTargetTypeEnum.TOPIC,
      actionDescription: '删除主题',
      beforeData: {
        sectionId: 4,
        userId: 6,
        title: '待删除主题',
      },
      afterData: { deleted: true },
    })
  })

  it('checks MOVE permission on both source and target sections when moving a topic', async () => {
    const {
      service,
      forumModeratorActionLogService,
      forumTopicFindFirst,
      forumTopicService,
      moderatorService,
    } = createService()
    forumTopicFindFirst.mockResolvedValue({
      id: 12,
      sectionId: 4,
      userId: 6,
      title: '待移动主题',
      isPinned: false,
      isFeatured: false,
      isLocked: false,
      isHidden: false,
      auditStatus: AuditStatusEnum.APPROVED,
      auditReason: null,
    })
    moderatorService.ensureModeratorPermissionForSection.mockResolvedValue({
      moderatorId: 9,
      moderatorUserId: 7,
      roleType: ForumModeratorRoleTypeEnum.SECTION,
      sectionId: 4,
      grantedPermissions: [ForumModeratorPermissionEnum.MOVE],
    })

    await service.moveTopic(
      { id: 12, sectionId: 8 },
      { actorType: 'moderator', actorUserId: 7 },
    )

    expect(
      moderatorService.ensureModeratorPermissionForSection,
    ).toHaveBeenNthCalledWith(1, 7, 4, ForumModeratorPermissionEnum.MOVE)
    expect(
      moderatorService.ensureModeratorPermissionForSection,
    ).toHaveBeenNthCalledWith(2, 7, 8, ForumModeratorPermissionEnum.MOVE)
    expect(forumTopicService.moveTopic).toHaveBeenCalledWith({
      id: 12,
      sectionId: 8,
    })
    expect(forumModeratorActionLogService.createActionLog).toHaveBeenCalledWith({
      moderatorId: 9,
      targetId: 12,
      actionType: ForumModeratorActionTypeEnum.MOVE_TOPIC,
      targetType: ForumModeratorActionTargetTypeEnum.TOPIC,
      actionDescription: '移动主题',
      beforeData: { sectionId: 4 },
      afterData: { sectionId: 8 },
    })
  })

  it('uses DELETE permission and writes moderator comment log when deleting a forum comment', async () => {
    const {
      service,
      commentService,
      forumModeratorActionLogService,
      forumTopicFindFirst,
      moderatorService,
      userCommentFindFirst,
    } = createService()
    userCommentFindFirst.mockResolvedValue({
      id: 18,
      targetType: CommentTargetTypeEnum.FORUM_TOPIC,
      targetId: 11,
      replyToId: 3,
      isHidden: false,
      auditStatus: AuditStatusEnum.PENDING,
      auditReason: null,
    })
    forumTopicFindFirst.mockResolvedValue({
      sectionId: 6,
    })
    moderatorService.ensureModeratorPermissionForSection.mockResolvedValue({
      moderatorId: 9,
      moderatorUserId: 7,
      roleType: ForumModeratorRoleTypeEnum.SECTION,
      sectionId: 6,
      grantedPermissions: [ForumModeratorPermissionEnum.DELETE],
    })

    await service.deleteComment(
      { id: 18 },
      { actorType: 'moderator', actorUserId: 7 },
    )

    expect(
      moderatorService.ensureModeratorPermissionForSection,
    ).toHaveBeenCalledWith(7, 6, ForumModeratorPermissionEnum.DELETE)
    expect(commentService.deleteComment).toHaveBeenCalledWith(18)
    expect(forumModeratorActionLogService.createActionLog).toHaveBeenCalledWith({
      moderatorId: 9,
      targetId: 18,
      actionType: ForumModeratorActionTypeEnum.DELETE_COMMENT,
      targetType: ForumModeratorActionTargetTypeEnum.COMMENT,
      actionDescription: '删除评论',
      beforeData: {
        targetType: CommentTargetTypeEnum.FORUM_TOPIC,
        targetId: 11,
        replyToId: 3,
      },
      afterData: { deleted: true },
    })
  })
})
