import type { Db } from '@db/core'
import type {
  ILikeTargetResolver,
  LikeTargetMeta,
} from '@libs/interaction/like/interfaces/like-target-resolver.type'
import { DrizzleService } from '@db/core'
import { LikeTargetTypeEnum } from '@libs/interaction/like/like.constant'
import { LikeService } from '@libs/interaction/like/like.service'
import { MessageDomainEventFactoryService } from '@libs/message/eventing/message-domain-event.factory'
import { MessageDomainEventPublisher as MessageDomainEventPublisherService } from '@libs/message/eventing/message-domain-event.publisher'
import {
  AuditStatusEnum,
  BusinessErrorCode,
  SceneTypeEnum,
} from '@libs/platform/constant'

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
 * 论坛主题点赞解析器
 * 负责处理论坛主题的点赞业务逻辑，包括验证主题存在性、解析场景元数据、更新点赞计数、发送通知等
 */
@Injectable()
export class ForumTopicLikeResolver
  implements ILikeTargetResolver, OnModuleInit
{
  // 标识本 resolver 处理论坛主题点赞目标。
  readonly targetType = LikeTargetTypeEnum.FORUM_TOPIC

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly likeService: LikeService,
    private readonly messageDomainEventPublisher: MessageDomainEventPublisherService,
    private readonly messageDomainEventFactoryService: MessageDomainEventFactoryService,
    private readonly forumCounterService: ForumCounterService,
    private readonly forumPermissionService: ForumPermissionService,
    private readonly actionLogService: ForumUserActionLogService,
  ) {}

  // 模块初始化时向点赞服务注册 forum topic resolver。
  onModuleInit() {
    this.likeService.registerResolver(this)
  }

  // 校验主题公开可见，并返回点赞场景、所有者和标题元数据。
  async resolveMeta(tx: Db, targetId: number) {
    const topic = await tx.query.forumTopic.findFirst({
      where: {
        id: targetId,
        auditStatus: AuditStatusEnum.APPROVED,
        isHidden: false,
        deletedAt: { isNull: true },
      },
      columns: { id: true, userId: true, title: true },
      with: {
        section: {
          columns: {
            groupId: true,
            deletedAt: true,
            isEnabled: true,
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
      !this.forumPermissionService.isSectionPubliclyAvailable(topic.section)
    ) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '帖子不存在',
      )
    }

    return {
      sceneType: SceneTypeEnum.FORUM_TOPIC,
      sceneId: targetId,
      ownerUserId: topic.userId,
      targetTitle: topic.title,
    }
  }

  // 点赞或取消点赞后同步主题与作者收到点赞计数。
  async applyCountDelta(tx: Db, targetId: number, delta: number) {
    if (delta === 0) {
      return
    }

    const topic = await tx.query.forumTopic.findFirst({
      where: {
        id: targetId,
        deletedAt: { isNull: true },
      },
      columns: { userId: true },
    })

    if (!topic) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '帖子不存在',
      )
    }

    await this.forumCounterService.updateTopicLikeRelatedCounts(
      tx,
      targetId,
      topic.userId,
      delta,
    )
  }

  // 点赞后记录用户动作，并向主题作者发送点赞通知。
  async postLikeHook(
    tx: Db,
    targetId: number,
    actorUserId: number,
    meta: LikeTargetMeta,
  ) {
    await this.actionLogService.createActionLogInTx(tx, {
      userId: actorUserId,
      actionType: ForumUserActionTypeEnum.LIKE_TOPIC,
      targetType: ForumUserActionTargetTypeEnum.TOPIC,
      targetId,
    })

    const receiverUserId = meta.ownerUserId
    if (!receiverUserId || receiverUserId === actorUserId) {
      return
    }

    const actor = await tx.query.appUser.findFirst({
      where: { id: actorUserId },
      columns: { nickname: true },
    })

    await this.messageDomainEventPublisher.publishInTx(
      tx,
      this.messageDomainEventFactoryService.buildTopicLikedEvent({
        receiverUserId,
        actorUserId,
        targetType: this.targetType,
        targetId,
        actorNickname: actor?.nickname,
        topicTitle: meta.targetTitle,
      }),
    )
  }

  // 取消点赞后写入论坛用户操作日志。
  async postUnlikeHook(tx: Db, targetId: number, actorUserId: number) {
    await this.actionLogService.createActionLogInTx(tx, {
      userId: actorUserId,
      actionType: ForumUserActionTypeEnum.UNLIKE_TOPIC,
      targetType: ForumUserActionTargetTypeEnum.TOPIC,
      targetId,
    })
  }

  // 批量获取点赞列表展示用的主题摘要。
  async batchGetDetails(targetIds: number[]) {
    if (targetIds.length === 0) {
      return new Map()
    }

    const topics = await this.drizzle.db.query.forumTopic.findMany({
      where: {
        id: { in: targetIds },
        auditStatus: AuditStatusEnum.APPROVED,
        isHidden: false,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        title: true,
        images: true,
        videos: true,
      },
      with: {
        section: {
          columns: {
            groupId: true,
            deletedAt: true,
            isEnabled: true,
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

    const visibleTopics = topics.filter(
      (topic) =>
        topic.section &&
        this.forumPermissionService.isSectionPubliclyAvailable(topic.section),
    )

    return new Map(
      visibleTopics.map((topic) => [
        topic.id,
        {
          id: topic.id,
          title: topic.title,
          images: topic.images,
          videos: topic.videos,
        },
      ]),
    )
  }
}
