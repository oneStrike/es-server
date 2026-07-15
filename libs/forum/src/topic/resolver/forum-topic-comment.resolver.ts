import type { DbExecutor } from '@db/core'
import type {
  CommentTargetBodyMaterializationInput,
  CommentTargetDeletionPayload,
  CommentTargetHookPayload,
  CommentTargetMeta,
  CommentTargetPersistedCommentPayload,
  CommentTargetVisibilitySyncPayload,
  ICommentTargetResolver,
} from '@libs/interaction/comment/interfaces/comment-target-resolver.type'
import type {
  ForumTopicCommentHookPayload,
  ForumTopicCommentTargetSnapshotOptions,
} from '../forum-topic.type'
import { DrizzleService } from '@db/core'
import { DomainEventPublisher } from '@libs/eventing/eventing/domain-event-publisher.service'
import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { CommentService } from '@libs/interaction/comment/comment.service'

import { AuditStatusEnum, BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, OnModuleInit } from '@nestjs/common'
import {
  ForumUserActionTargetTypeEnum,
  ForumUserActionTypeEnum,
} from '../../action-log/action-log.constant'
import { ForumUserActionLogService } from '../../action-log/action-log.service'
import { ForumCounterService } from '../../counter/forum-counter.service'
import { ForumHashtagBodyService } from '../../hashtag/forum-hashtag-body.service'
import { ForumHashtagReferenceService } from '../../hashtag/forum-hashtag-reference.service'
import {
  ForumHashtagCreateSourceTypeEnum,
  ForumHashtagReferenceSourceTypeEnum,
} from '../../hashtag/forum-hashtag.constant'
import { ForumPermissionService } from '../../permission/forum-permission.service'
import { ForumTopicEventFactoryService } from '../forum-topic-event-factory.service'

/**
 * 论坛帖子评论解析器
 * 处理论坛帖子的评论相关操作
 */
@Injectable()
export class ForumTopicCommentResolver
  implements ICommentTargetResolver, OnModuleInit
{
  // 标识本 resolver 处理论坛主题评论目标。
  readonly targetType = CommentTargetTypeEnum.FORUM_TOPIC

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly commentService: CommentService,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly forumTopicEventFactoryService: ForumTopicEventFactoryService,
    private readonly forumCounterService: ForumCounterService,
    private readonly actionLogService: ForumUserActionLogService,
    private readonly forumPermissionService: ForumPermissionService,
    private readonly forumHashtagBodyService: ForumHashtagBodyService,
    private readonly forumHashtagReferenceService: ForumHashtagReferenceService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  // 读取评论目标主题快照；用户写入链要求公开可见，治理链只要求主题与板块存在。
  private async getTopicCommentTargetSnapshot(
    tx: DbExecutor,
    targetId: number,
    options: ForumTopicCommentTargetSnapshotOptions,
  ) {
    const topic = await tx.query.forumTopic.findFirst({
      where: {
        id: targetId,
        deletedAt: { isNull: true },
        ...(options.requirePublicVisible
          ? {
              auditStatus: AuditStatusEnum.APPROVED,
              isHidden: false,
            }
          : {}),
      },
      columns: {
        isLocked: true,
        userId: true,
        sectionId: true,
        title: true,
      },
      with: {
        section: {
          columns: {
            groupId: true,
            isEnabled: true,
            deletedAt: true,
          },
          with: {
            group: {
              columns: {
                isEnabled: true,
                deletedAt: true,
              },
            },
          },
        },
      },
    })

    if (
      !topic ||
      !topic.section ||
      topic.section.deletedAt ||
      !topic.section.isEnabled ||
      (options.requirePublicVisible &&
        !this.forumPermissionService.isSectionPubliclyAvailable(topic.section))
    ) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '帖子不存在',
      )
    }

    return topic
  }

  // 模块初始化时向评论服务注册 forum topic resolver。
  onModuleInit() {
    this.commentService.registerResolver(this)
  }

  // 评论计数由 CommentService 统一维护，这里只满足 resolver 协议。
  async applyCountDelta(_tx: DbExecutor, _targetId: number, _delta: number) {}

  // 校验主题存在、公开可见且未锁定，失败时抛业务异常。
  async ensureCanComment(tx: DbExecutor, targetId: number) {
    const topic = await this.getTopicCommentTargetSnapshot(tx, targetId, {
      requirePublicVisible: true,
    })

    if (topic.isLocked) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '帖子已被锁定，无法评论',
      )
    }
  }

  // 在已锁定且验证公开可见的主题事务链路内校验论坛板块访问权限。
  async ensureActorCanComment(
    tx: DbExecutor,
    targetId: number,
    actorUserId: number,
  ) {
    await this.forumPermissionService.ensureUserCanAccessTopicSection(
      targetId,
      actorUserId,
      tx,
    )
  }

  // 把论坛正文中的 hashtag 物化为正式资源与 canonical body node。
  async materializeCommentBodyInTx(
    input: CommentTargetBodyMaterializationInput,
  ) {
    const materialized = await this.forumHashtagBodyService.materializeBodyInTx(
      {
        tx: input.tx,
        body: input.body,
        actorUserId: input.actorUserId,
        createSourceType: ForumHashtagCreateSourceTypeEnum.COMMENT_BODY,
      },
    )

    return materialized.body
  }

  // 判断主题是否对外可见，供评论引用事实计算父级可见性。
  private async isTopicVisibleInTx(tx: DbExecutor, targetId: number) {
    const topic = await tx.query.forumTopic.findFirst({
      where: {
        id: targetId,
        deletedAt: { isNull: true },
      },
      columns: {
        auditStatus: true,
        isHidden: true,
      },
    })

    return (
      !!topic &&
      topic.auditStatus === AuditStatusEnum.APPROVED &&
      !topic.isHidden
    )
  }

  // 新评论持久化后，在同一事务替换论坛 hashtag 引用事实。
  async postPersistedCommentHook(
    tx: DbExecutor,
    comment: CommentTargetPersistedCommentPayload,
    meta: CommentTargetMeta,
  ) {
    if (!meta.sectionId) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '帖子板块信息缺失',
      )
    }

    await this.forumHashtagReferenceService.replaceReferencesInTx({
      tx,
      sourceType: ForumHashtagReferenceSourceTypeEnum.COMMENT,
      sourceId: comment.id,
      topicId: comment.targetId,
      sectionId: meta.sectionId,
      userId: comment.userId,
      sourceAuditStatus: comment.auditStatus,
      sourceIsHidden: comment.isHidden,
      isSourceVisible:
        comment.isVisible &&
        (await this.isTopicVisibleInTx(tx, comment.targetId)),
      hashtagFacts: this.forumHashtagBodyService.getMaterializedHashtagFacts(
        comment.body,
      ),
    })
  }

  // 评论审核或隐藏状态变更后同步论坛 hashtag 引用可见性，即使可见性未跨越边界也执行。
  async syncCommentVisibilityHook(
    tx: DbExecutor,
    comment: CommentTargetVisibilitySyncPayload,
  ) {
    await this.forumHashtagReferenceService.syncSourceVisibilityInTx({
      tx,
      sourceType: ForumHashtagReferenceSourceTypeEnum.COMMENT,
      sourceId: comment.id,
      sourceAuditStatus: comment.auditStatus,
      sourceIsHidden: comment.isHidden,
      isSourceVisible:
        comment.isVisible &&
        (await this.isTopicVisibleInTx(tx, comment.targetId)),
    })
  }

  // 评论删除范围无论可见性如何都必须清理其论坛 hashtag 引用事实。
  async deleteCommentsHook(
    tx: DbExecutor,
    payload: CommentTargetDeletionPayload,
  ) {
    await this.forumHashtagReferenceService.deleteReferencesInTx({
      tx,
      sourceType: ForumHashtagReferenceSourceTypeEnum.COMMENT,
      sourceIds: payload.commentIds,
    })
  }

  // 读取主题作者，目标缺失时保持 undefined，以维持评论筛选与预览的空结果语义。
  async resolveTargetAuthorUserId(targetId: number) {
    const topic = await this.db.query.forumTopic.findFirst({
      where: {
        id: targetId,
        deletedAt: { isNull: true },
      },
      columns: {
        userId: true,
      },
    })

    return topic?.userId
  }

  // 解析主题作者、板块和标题，供评论通知与计数同步复用。
  async resolveMeta(tx: DbExecutor, targetId: number) {
    const topic = await this.getTopicCommentTargetSnapshot(tx, targetId, {
      requirePublicVisible: false,
    })

    return {
      ownerUserId: topic.userId,
      sectionId: topic.sectionId,
      targetDisplayTitle: topic.title,
    }
  }

  // 评论创建后同步主题/板块计数、记录操作日志并发送主题被评论通知。
  async postCommentHook(
    tx: DbExecutor,
    comment: ForumTopicCommentHookPayload,
    meta: CommentTargetMeta,
  ) {
    if (!meta.sectionId) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '帖子板块信息缺失',
      )
    }

    await this.forumCounterService.syncTopicCommentState(tx, comment.targetId)
    await this.forumCounterService.syncSectionVisibleState(tx, meta.sectionId)
    await this.actionLogService.createActionLogInTx(tx, {
      userId: comment.userId,
      actionType: ForumUserActionTypeEnum.CREATE_COMMENT,
      targetType: ForumUserActionTargetTypeEnum.COMMENT,
      targetId: comment.id,
      afterData: JSON.stringify({
        id: comment.id,
        targetId: comment.targetId,
        replyToId: comment.replyToId,
        content: comment.content,
        createdAt: comment.createdAt,
      }),
    })

    if (comment.replyToId) {
      return
    }

    const receiverUserId = meta.ownerUserId
    if (!receiverUserId || receiverUserId === comment.userId) {
      return
    }

    const actor = await tx.query.appUser.findFirst({
      where: { id: comment.userId },
      columns: { nickname: true },
    })

    await this.domainEventPublisher.publishInTx(
      tx,
      this.forumTopicEventFactoryService.buildTopicCommentedEvent({
        receiverUserId,
        actorUserId: comment.userId,
        commentId: comment.id,
        targetType: comment.targetType,
        targetId: comment.targetId,
        actorNickname: actor?.nickname,
        topicTitle: meta.targetDisplayTitle,
        commentExcerpt: comment.content,
      }),
    )
  }

  // 评论删除后同步主题/板块计数并记录操作日志。
  async postDeleteCommentHook(
    tx: DbExecutor,
    comment: CommentTargetHookPayload,
    meta: CommentTargetMeta,
  ) {
    if (!meta.sectionId) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '帖子板块信息缺失',
      )
    }

    await this.forumCounterService.syncTopicCommentState(tx, comment.targetId)
    await this.forumCounterService.syncSectionVisibleState(tx, meta.sectionId)
    await this.actionLogService.createActionLogInTx(tx, {
      userId: comment.userId,
      actionType: ForumUserActionTypeEnum.DELETE_COMMENT,
      targetType: ForumUserActionTargetTypeEnum.COMMENT,
      targetId: comment.id,
      beforeData: JSON.stringify({
        id: comment.id,
        targetId: comment.targetId,
        replyToId: comment.replyToId,
        content: comment.content,
        createdAt: comment.createdAt,
      }),
    })
  }
}
