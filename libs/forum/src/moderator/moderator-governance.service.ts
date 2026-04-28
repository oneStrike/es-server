import type { ForumTopicClientContext } from '../topic/forum-topic.type'
import type {
  ForumModeratorGovernanceActor,
  ForumModeratorPermissionGrant,
} from './moderator.type'
import { DrizzleService } from '@db/core'
import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { CommentService } from '@libs/interaction/comment/comment.service'
import {
  UpdateCommentAuditStatusDto,
  UpdateCommentHiddenDto,
} from '@libs/interaction/comment/dto/comment.dto'
import { AuditRoleEnum, BusinessErrorCode } from '@libs/platform/constant'
import { IdDto } from '@libs/platform/dto'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import {
  MoveForumTopicDto,
  UpdateForumTopicAuditStatusDto,
  UpdateForumTopicFeaturedDto,
  UpdateForumTopicHiddenDto,
  UpdateForumTopicLockedDto,
  UpdateForumTopicPinnedDto,
} from '../topic/dto/forum-topic.dto'
import { ForumTopicService } from '../topic/forum-topic.service'
import {
  ForumModeratorActionTargetTypeEnum,
  ForumModeratorActionTypeEnum,
} from './moderator-action-log.constant'
import { ForumModeratorActionLogService } from './moderator-action-log.service'
import {
  FORUM_MODERATOR_PERMISSION_LABELS,
  ForumModeratorPermissionEnum,
} from './moderator.constant'
import { ForumModeratorService } from './moderator.service'

/**
 * 版主治理服务。
 * 统一编排 moderator/admin 对 topic/comment 的治理入口、权限校验与 action log 落库。
 */
@Injectable()
export class ForumModeratorGovernanceService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly forumModeratorService: ForumModeratorService,
    private readonly forumTopicService: ForumTopicService,
    private readonly commentService: CommentService,
    private readonly forumModeratorActionLogService: ForumModeratorActionLogService,
  ) {}

  /** 统一复用当前模块的 Drizzle 数据库实例。 */
  private get db() {
    return this.drizzle.db
  }

  /** forum_topic 表访问入口。 */
  private get forumTopic() {
    return this.drizzle.schema.forumTopic
  }

  /** user_comment 表访问入口。 */
  private get userComment() {
    return this.drizzle.schema.userComment
  }

  /**
   * 解析治理 actor 的审核角色枚举。
   * 当前仅 topic/comment 审核动作需要回填审核角色。
   */
  private resolveAuditRole(actor: ForumModeratorGovernanceActor) {
    return actor.actorType === 'moderator'
      ? AuditRoleEnum.MODERATOR
      : AuditRoleEnum.ADMIN
  }

  /**
   * 根据治理 actor 决定是否需要版主权限校验。
   * admin 直接放行，moderator 则按板块作用域和权限做强校验。
   */
  private async resolveModeratorGrant(
    actor: ForumModeratorGovernanceActor,
    sectionId: number,
    permission: ForumModeratorPermissionEnum,
  ) {
    if (actor.actorType !== 'moderator') {
      return null
    }

    return this.forumModeratorService.ensureModeratorPermissionForSection(
      actor.actorUserId,
      sectionId,
      permission,
    )
  }

  /**
   * 查询主题治理所需的当前快照。
   * 统一补齐板块作用域与现态字段，供权限校验和日志使用。
   */
  private async getTopicGovernanceSnapshot(topicId: number) {
    const topic = await this.db.query.forumTopic.findFirst({
      where: {
        id: topicId,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        sectionId: true,
        userId: true,
        title: true,
        isPinned: true,
        isFeatured: true,
        isLocked: true,
        isHidden: true,
        auditStatus: true,
        auditReason: true,
      },
    })

    if (!topic) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '主题不存在',
      )
    }

    return topic
  }

  /**
   * 查询论坛评论治理所需的当前快照。
   * 非 forum comment 会被直接拦截，避免版主权限误作用到跨域评论。
   */
  private async getCommentGovernanceSnapshot(commentId: number) {
    const comment = await this.db.query.userComment.findFirst({
      where: {
        id: commentId,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        targetType: true,
        targetId: true,
        replyToId: true,
        isHidden: true,
        auditStatus: true,
        auditReason: true,
      },
    })

    if (!comment) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '评论不存在',
      )
    }

    return comment
  }

  /**
   * 解析评论治理需要的 moderator 权限上下文。
   * admin 不受 forum comment 作用域限制；moderator 只允许治理论坛评论。
   */
  private async resolveCommentModeratorGrant(
    actor: ForumModeratorGovernanceActor,
    comment: Awaited<
      ReturnType<ForumModeratorGovernanceService['getCommentGovernanceSnapshot']>
    >,
    permission: ForumModeratorPermissionEnum,
  ) {
    if (actor.actorType !== 'moderator') {
      return null
    }

    if (comment.targetType !== CommentTargetTypeEnum.FORUM_TOPIC) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '当前版主仅支持治理论坛评论',
      )
    }

    const topic = await this.db.query.forumTopic.findFirst({
      where: {
        id: comment.targetId,
        deletedAt: { isNull: true },
      },
      columns: {
        sectionId: true,
      },
    })

    if (!topic) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '评论所属主题不存在',
      )
    }

    return this.resolveModeratorGrant(actor, topic.sectionId, permission)
  }

  /**
   * 移动主题前校验 moderator 是否同时对来源和目标板块具备 MOVE 权限。
   * 同板块 no-op 时仅校验来源板块，避免重复鉴权。
   */
  private async resolveTopicMoveGrant(
    actor: ForumModeratorGovernanceActor,
    currentSectionId: number,
    nextSectionId: number,
  ) {
    const sourceGrant = await this.resolveModeratorGrant(
      actor,
      currentSectionId,
      ForumModeratorPermissionEnum.MOVE,
    )

    if (actor.actorType !== 'moderator' || currentSectionId === nextSectionId) {
      return sourceGrant
    }

    await this.resolveModeratorGrant(
      actor,
      nextSectionId,
      ForumModeratorPermissionEnum.MOVE,
    )

    return sourceGrant
  }

  /**
   * 写入 topic moderator action log。
   * 仅 moderator actor 落日志，admin 走共享事实写入主链但不写版主日志。
   */
  private async createTopicActionLog(params: {
    grant: ForumModeratorPermissionGrant | null
    topicId: number
    actionType: ForumModeratorActionTypeEnum
    actionDescription: string
    beforeData: Record<string, unknown>
    afterData: Record<string, unknown>
  }) {
    if (!params.grant) {
      return true
    }

    await this.forumModeratorActionLogService.createActionLog({
      moderatorId: params.grant.moderatorId,
      targetId: params.topicId,
      actionType: params.actionType,
      targetType: ForumModeratorActionTargetTypeEnum.TOPIC,
      actionDescription: params.actionDescription,
      beforeData: params.beforeData,
      afterData: params.afterData,
    })

    return true
  }

  /**
   * 写入 comment moderator action log。
   * 统一记录 moderator 对 forum comment 的审核/隐藏动作。
   */
  private async createCommentActionLog(params: {
    grant: ForumModeratorPermissionGrant | null
    commentId: number
    actionType: ForumModeratorActionTypeEnum
    actionDescription: string
    beforeData: Record<string, unknown>
    afterData: Record<string, unknown>
  }) {
    if (!params.grant) {
      return true
    }

    await this.forumModeratorActionLogService.createActionLog({
      moderatorId: params.grant.moderatorId,
      targetId: params.commentId,
      actionType: params.actionType,
      targetType: ForumModeratorActionTargetTypeEnum.COMMENT,
      actionDescription: params.actionDescription,
      beforeData: params.beforeData,
      afterData: params.afterData,
    })

    return true
  }

  /**
   * 更新主题置顶状态。
   * moderator 需具备 PIN 权限；admin 共享同一事实写入链但跳过 moderator 权限校验。
   */
  async updateTopicPinned(
    input: UpdateForumTopicPinnedDto,
    actor: ForumModeratorGovernanceActor,
  ) {
    const current = await this.getTopicGovernanceSnapshot(input.id)
    const grant = await this.resolveModeratorGrant(
      actor,
      current.sectionId,
      ForumModeratorPermissionEnum.PIN,
    )

    await this.forumTopicService.updateTopicPinned(input)
    await this.createTopicActionLog({
      grant,
      topicId: current.id,
      actionType: input.isPinned
        ? ForumModeratorActionTypeEnum.PIN_TOPIC
        : ForumModeratorActionTypeEnum.UNPIN_TOPIC,
      actionDescription: input.isPinned ? '置顶主题' : '取消置顶主题',
      beforeData: { isPinned: current.isPinned },
      afterData: { isPinned: input.isPinned },
    })

    return true
  }

  /**
   * 更新主题精华状态。
   * moderator 需具备 FEATURE 权限。
   */
  async updateTopicFeatured(
    input: UpdateForumTopicFeaturedDto,
    actor: ForumModeratorGovernanceActor,
  ) {
    const current = await this.getTopicGovernanceSnapshot(input.id)
    const grant = await this.resolveModeratorGrant(
      actor,
      current.sectionId,
      ForumModeratorPermissionEnum.FEATURE,
    )

    await this.forumTopicService.updateTopicFeatured(input)
    await this.createTopicActionLog({
      grant,
      topicId: current.id,
      actionType: input.isFeatured
        ? ForumModeratorActionTypeEnum.FEATURE_TOPIC
        : ForumModeratorActionTypeEnum.UNFEATURE_TOPIC,
      actionDescription: input.isFeatured ? '加精主题' : '取消加精主题',
      beforeData: { isFeatured: current.isFeatured },
      afterData: { isFeatured: input.isFeatured },
    })

    return true
  }

  /**
   * 更新主题锁定状态。
   * moderator 需具备 LOCK 权限。
   */
  async updateTopicLocked(
    input: UpdateForumTopicLockedDto,
    actor: ForumModeratorGovernanceActor,
  ) {
    const current = await this.getTopicGovernanceSnapshot(input.id)
    const grant = await this.resolveModeratorGrant(
      actor,
      current.sectionId,
      ForumModeratorPermissionEnum.LOCK,
    )

    await this.forumTopicService.updateTopicLocked(input)
    await this.createTopicActionLog({
      grant,
      topicId: current.id,
      actionType: input.isLocked
        ? ForumModeratorActionTypeEnum.LOCK_TOPIC
        : ForumModeratorActionTypeEnum.UNLOCK_TOPIC,
      actionDescription: input.isLocked ? '锁定主题' : '取消锁定主题',
      beforeData: { isLocked: current.isLocked },
      afterData: { isLocked: input.isLocked },
    })

    return true
  }

  /**
   * 删除主题。
   * moderator 需具备 DELETE 权限；删除动作走正式 topic 删除链并补记 moderator action log。
   */
  async deleteTopic(
    input: IdDto,
    actor: ForumModeratorGovernanceActor,
    context: ForumTopicClientContext = {},
  ) {
    const current = await this.getTopicGovernanceSnapshot(input.id)
    const grant = await this.resolveModeratorGrant(
      actor,
      current.sectionId,
      ForumModeratorPermissionEnum.DELETE,
    )

    await this.forumTopicService.deleteTopic(
      current.id,
      context,
      actor.actorUserId,
    )
    await this.createTopicActionLog({
      grant,
      topicId: current.id,
      actionType: ForumModeratorActionTypeEnum.DELETE_TOPIC,
      actionDescription: '删除主题',
      beforeData: {
        sectionId: current.sectionId,
        userId: current.userId,
        title: current.title,
      },
      afterData: { deleted: true },
    })

    return true
  }

  /**
   * 移动主题板块归属。
   * moderator 需同时具备来源板块和目标板块的 MOVE 权限，避免跨板块越权搬运主题。
   */
  async moveTopic(
    input: MoveForumTopicDto,
    actor: ForumModeratorGovernanceActor,
  ) {
    const current = await this.getTopicGovernanceSnapshot(input.id)
    const grant = await this.resolveTopicMoveGrant(
      actor,
      current.sectionId,
      input.sectionId,
    )

    await this.forumTopicService.moveTopic(input)
    await this.createTopicActionLog({
      grant,
      topicId: current.id,
      actionType: ForumModeratorActionTypeEnum.MOVE_TOPIC,
      actionDescription: '移动主题',
      beforeData: { sectionId: current.sectionId },
      afterData: { sectionId: input.sectionId },
    })

    return true
  }

  /**
   * 更新主题隐藏状态。
   * 当前把隐藏/取消隐藏视为 moderator 的 DELETE 权限语义。
   */
  async updateTopicHidden(
    input: UpdateForumTopicHiddenDto,
    actor: ForumModeratorGovernanceActor,
  ) {
    const current = await this.getTopicGovernanceSnapshot(input.id)
    const grant = await this.resolveModeratorGrant(
      actor,
      current.sectionId,
      ForumModeratorPermissionEnum.DELETE,
    )

    await this.forumTopicService.updateTopicHidden(input)
    await this.createTopicActionLog({
      grant,
      topicId: current.id,
      actionType: input.isHidden
        ? ForumModeratorActionTypeEnum.HIDE_TOPIC
        : ForumModeratorActionTypeEnum.UNHIDE_TOPIC,
      actionDescription: input.isHidden ? '隐藏主题' : '取消隐藏主题',
      beforeData: { isHidden: current.isHidden },
      afterData: { isHidden: input.isHidden },
    })

    return true
  }

  /**
   * 更新主题审核状态。
   * moderator 需具备 AUDIT 权限；topic auditBy/auditRole 由治理 actor 上下文统一回填。
   */
  async updateTopicAuditStatus(
    input: UpdateForumTopicAuditStatusDto,
    actor: ForumModeratorGovernanceActor,
  ) {
    const current = await this.getTopicGovernanceSnapshot(input.id)
    const grant = await this.resolveModeratorGrant(
      actor,
      current.sectionId,
      ForumModeratorPermissionEnum.AUDIT,
    )

    await this.forumTopicService.updateTopicAuditStatus(input, {
      auditById: actor.actorUserId,
      auditRole: this.resolveAuditRole(actor),
    })
    await this.createTopicActionLog({
      grant,
      topicId: current.id,
      actionType: ForumModeratorActionTypeEnum.AUDIT_TOPIC,
      actionDescription: `审核主题（${input.auditStatus}）`,
      beforeData: {
        auditStatus: current.auditStatus,
        auditReason: current.auditReason ?? null,
      },
      afterData: {
        auditStatus: input.auditStatus,
        auditReason: input.auditReason ?? null,
      },
    })

    return true
  }

  /**
   * 更新评论隐藏状态。
   * 当前把评论隐藏视为 moderator 的 DELETE 权限语义。
   */
  async updateCommentHidden(
    input: UpdateCommentHiddenDto,
    actor: ForumModeratorGovernanceActor,
  ) {
    const current = await this.getCommentGovernanceSnapshot(input.id)
    const grant = await this.resolveCommentModeratorGrant(
      actor,
      current,
      ForumModeratorPermissionEnum.DELETE,
    )

    await this.commentService.updateCommentHidden(input)
    await this.createCommentActionLog({
      grant,
      commentId: current.id,
      actionType: input.isHidden
        ? ForumModeratorActionTypeEnum.HIDE_COMMENT
        : ForumModeratorActionTypeEnum.UNHIDE_COMMENT,
      actionDescription: input.isHidden ? '隐藏评论' : '取消隐藏评论',
      beforeData: { isHidden: current.isHidden },
      afterData: { isHidden: input.isHidden },
    })

    return true
  }

  /**
   * 删除评论。
   * forum comment 的 moderator 删除会复用正式评论删除链，并记录版主删除日志。
   */
  async deleteComment(input: IdDto, actor: ForumModeratorGovernanceActor) {
    const current = await this.getCommentGovernanceSnapshot(input.id)
    const grant = await this.resolveCommentModeratorGrant(
      actor,
      current,
      ForumModeratorPermissionEnum.DELETE,
    )

    await this.commentService.deleteComment(current.id)
    await this.createCommentActionLog({
      grant,
      commentId: current.id,
      actionType: ForumModeratorActionTypeEnum.DELETE_COMMENT,
      actionDescription: '删除评论',
      beforeData: {
        targetType: current.targetType,
        targetId: current.targetId,
        replyToId: current.replyToId,
      },
      afterData: { deleted: true },
    })

    return true
  }

  /**
   * 更新评论审核状态。
   * forum comment 的 moderator 审核会同时回填 auditBy/auditRole，并记录正式版主日志。
   */
  async updateCommentAuditStatus(
    input: UpdateCommentAuditStatusDto,
    actor: ForumModeratorGovernanceActor,
  ) {
    const current = await this.getCommentGovernanceSnapshot(input.id)
    const grant = await this.resolveCommentModeratorGrant(
      actor,
      current,
      ForumModeratorPermissionEnum.AUDIT,
    )

    await this.commentService.updateCommentAuditStatus({
      ...input,
      auditById: actor.actorUserId,
      auditRole: this.resolveAuditRole(actor),
    })
    await this.createCommentActionLog({
      grant,
      commentId: current.id,
      actionType: ForumModeratorActionTypeEnum.AUDIT_COMMENT,
      actionDescription: `审核评论（${input.auditStatus}）`,
      beforeData: {
        auditStatus: current.auditStatus,
        auditReason: current.auditReason ?? null,
      },
      afterData: {
        auditStatus: input.auditStatus,
        auditReason: input.auditReason ?? null,
      },
    })

    return true
  }

  /**
   * 返回 moderator permissions 的中文提示。
   * 当前用于 controller / service 报错文案与调试输出对齐。
   */
  getPermissionLabel(permission: ForumModeratorPermissionEnum) {
    return FORUM_MODERATOR_PERMISSION_LABELS[permission]
  }
}
