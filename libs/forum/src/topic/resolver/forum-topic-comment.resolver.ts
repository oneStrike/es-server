import type { Db } from '@db/core'
import type {
  CommentTargetHookPayload,
  CommentTargetMeta,
  ICommentTargetResolver,
} from '@libs/interaction/comment/interfaces/comment-target-resolver.interface'
import type {
  ForumTopicCommentHookPayload,
  ForumTopicCommentTargetSnapshotOptions,
} from '../forum-topic.type'
import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { CommentService } from '@libs/interaction/comment/comment.service'
import { MessageDomainEventFactoryService } from '@libs/message/eventing/message-domain-event.factory'
import { MessageDomainEventPublisher as MessageDomainEventPublisherService } from '@libs/message/eventing/message-domain-event.publisher'

import { AuditStatusEnum, BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, OnModuleInit } from '@nestjs/common'
import {
  ForumUserActionTargetTypeEnum,
  ForumUserActionTypeEnum,
} from '../../action-log/action-log.constant'
import { ForumUserActionLogService } from '../../action-log/action-log.service'
import { ForumCounterService } from '../../counter/forum-counter.service'
import { ForumPermissionService } from '../../permission/forum-permission.service'

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
    private readonly commentService: CommentService,
    private readonly messageDomainEventPublisher: MessageDomainEventPublisherService,
    private readonly messageDomainEventFactoryService: MessageDomainEventFactoryService,
    private readonly forumCounterService: ForumCounterService,
    private readonly actionLogService: ForumUserActionLogService,
    private readonly forumPermissionService: ForumPermissionService,
  ) {}

  // 读取评论目标主题快照；用户写入链要求公开可见，治理链只要求主题与板块存在。
  private async getTopicCommentTargetSnapshot(
    tx: Db,
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
  async applyCountDelta(_tx: Db, _targetId: number, _delta: number) {}

  // 校验主题存在、公开可见且未锁定，失败时抛业务异常。
  async ensureCanComment(tx: Db, targetId: number) {
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

  // 解析主题作者、板块和标题，供评论通知与计数同步复用。
  async resolveMeta(tx: Db, targetId: number) {
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
    tx: Db,
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

    await this.messageDomainEventPublisher.publishInTx(
      tx,
      this.messageDomainEventFactoryService.buildTopicCommentedEvent({
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
    tx: Db,
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
