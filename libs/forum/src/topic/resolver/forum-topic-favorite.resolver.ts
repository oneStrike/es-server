import type { DbExecutor } from '@db/core'
import type {
  FavoriteTargetContext,
  IFavoriteTargetResolver,
} from '@libs/interaction/favorite/interfaces/favorite-target-resolver.type'
import { FavoriteTargetTypeEnum } from '@libs/interaction/favorite/favorite.constant'
import { FavoriteService } from '@libs/interaction/favorite/favorite.service'
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
import { ForumTopicService } from '../forum-topic.service'

/**
 * 论坛主题收藏解析器
 * 负责处理论坛主题的收藏业务逻辑，包括验证主题存在性、更新收藏计数、发送通知等
 */
@Injectable()
export class ForumTopicFavoriteResolver
  implements IFavoriteTargetResolver, OnModuleInit
{
  // 标识本 resolver 处理论坛主题收藏目标。
  readonly targetType = FavoriteTargetTypeEnum.FORUM_TOPIC

  constructor(
    private readonly favoriteService: FavoriteService,
    private readonly messageDomainEventPublisher: MessageDomainEventPublisherService,
    private readonly messageDomainEventFactoryService: MessageDomainEventFactoryService,
    private readonly forumCounterService: ForumCounterService,
    private readonly forumPermissionService: ForumPermissionService,
    private readonly forumTopicService: ForumTopicService,
    private readonly actionLogService: ForumUserActionLogService,
  ) {}

  // 模块初始化时向收藏服务注册 forum topic resolver。
  onModuleInit() {
    this.favoriteService.registerResolver(this)
  }

  // 校验主题公开可见，并返回收藏通知需要的所有者和标题。
  async ensureExists(tx: DbExecutor, targetId: number) {
    const topic = await tx.query.forumTopic.findFirst({
      where: {
        id: targetId,
        auditStatus: AuditStatusEnum.APPROVED,
        isHidden: false,
        deletedAt: { isNull: true },
      },
      columns: { userId: true, title: true },
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
      ownerUserId: topic.userId,
      targetTitle: topic.title,
    }
  }

  // 收藏或取消收藏后同步主题与作者收到收藏计数。
  async applyCountDelta(tx: DbExecutor, targetId: number, delta: number) {
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

    await this.forumCounterService.updateTopicFavoriteRelatedCounts(
      tx,
      targetId,
      topic.userId,
      delta,
    )
  }

  // 收藏后记录用户动作，并向主题作者发送收藏通知。
  async postFavoriteHook(
    tx: DbExecutor,
    targetId: number,
    actorUserId: number,
    options: FavoriteTargetContext,
  ) {
    await this.actionLogService.createActionLogInTx(tx, {
      userId: actorUserId,
      actionType: ForumUserActionTypeEnum.FAVORITE_TOPIC,
      targetType: ForumUserActionTargetTypeEnum.TOPIC,
      targetId,
    })

    const { ownerUserId: receiverUserId, targetTitle } = options

    if (receiverUserId === undefined || receiverUserId === actorUserId) {
      return
    }

    const actor = await tx.query.appUser.findFirst({
      where: { id: actorUserId },
      columns: { nickname: true },
    })

    await this.messageDomainEventPublisher.publishInTx(
      tx,
      this.messageDomainEventFactoryService.buildTopicFavoritedEvent({
        receiverUserId,
        actorUserId,
        targetType: this.targetType,
        targetId,
        actorNickname: actor?.nickname,
        topicTitle: targetTitle,
      }),
    )
  }

  // 取消收藏后写入论坛用户操作日志。
  async postUnfavoriteHook(
    tx: DbExecutor,
    targetId: number,
    actorUserId: number,
  ) {
    await this.actionLogService.createActionLogInTx(tx, {
      userId: actorUserId,
      actionType: ForumUserActionTypeEnum.UNFAVORITE_TOPIC,
      targetType: ForumUserActionTargetTypeEnum.TOPIC,
      targetId,
    })
  }

  // 批量获取收藏列表展示用的主题详情。
  async batchGetDetails(targetIds: number[], userId?: number) {
    return this.forumTopicService.batchGetFavoriteTopicDetails(
      targetIds,
      userId,
    )
  }
}
