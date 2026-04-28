import type { Db } from '@db/core'
import type { CommentTargetHookPayload, CommentTargetMeta } from '@libs/interaction/comment/interfaces/comment-target-resolver.interface'
import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { CommentService } from '@libs/interaction/comment/comment.service'
import { ICommentTargetResolver } from '@libs/interaction/comment/interfaces/comment-target-resolver.interface'
import {
  MessageDomainEventFactoryService,
} from '@libs/message/eventing/message-domain-event.factory'
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
  /** 目标类型：论坛帖子 */
  readonly targetType = CommentTargetTypeEnum.FORUM_TOPIC

  constructor(
    private readonly commentService: CommentService,
    private readonly messageDomainEventPublisher: MessageDomainEventPublisherService,
    private readonly messageDomainEventFactoryService: MessageDomainEventFactoryService,
    private readonly forumCounterService: ForumCounterService,
    private readonly actionLogService: ForumUserActionLogService,
    private readonly forumPermissionService: ForumPermissionService,
  ) {}

  /**
   * 读取评论目标主题快照。
   * 用户侧写入链要求主题当前可公开评论；内部治理链只要求主题与板块仍存在。
   */
  private async getTopicCommentTargetSnapshot(
    tx: Db,
    targetId: number,
    options: {
      requirePublicVisible: boolean
    },
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

  /**
   * 模块初始化时注册解析器
   */
  onModuleInit() {
    this.commentService.registerResolver(this)
  }

  /**
   * 应用评论计数增量
   * 论坛主题的用户评论计数由 CommentService 统一维护
   *
   * @param _tx - 事务客户端
   * @param _targetId - 目标帖子ID
   * @param _delta - 变更量（+1 增加，-1 减少）
   */
  async applyCountDelta(_tx: Db, _targetId: number, _delta: number) {}

  /**
   * 校验是否允许对该帖子发表评论
   * 检查帖子是否存在、是否被锁定
   *
   * @param tx - 事务客户端
   * @param targetId - 目标帖子ID
   * @throws 当帖子不存在或被锁定时抛出 BadRequestException
   */
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

  /**
   * 解析帖子的元信息
   * 获取帖子作者ID，用于发送被评论通知
   *
   * @param tx - 事务客户端
   * @param targetId - 目标帖子ID
   * @returns 目标元信息，包含所有者用户ID
   */
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

  async postCommentHook(
    tx: Db,
    comment: CommentTargetHookPayload & { content: string },
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
