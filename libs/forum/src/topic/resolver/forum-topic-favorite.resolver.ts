import type { Db } from '@db/core'
import { DrizzleService } from '@db/core'
import { FavoriteTargetTypeEnum } from '@libs/interaction/favorite/favorite.constant'
import { FavoriteService } from '@libs/interaction/favorite/favorite.service'
import {
  FavoriteTargetContext,
  IFavoriteTargetResolver,
} from '@libs/interaction/favorite/interfaces/favorite-target-resolver.interface'
import {
  MessageDomainEventFactoryService,
} from '@libs/message/eventing/message-domain-event.factory'
import { MessageDomainEventPublisher as MessageDomainEventPublisherService } from '@libs/message/eventing/message-domain-event.publisher'
import { BusinessErrorCode } from '@libs/platform/constant'
import { AuditStatusEnum } from '@libs/platform/constant/audit.constant'
import { BusinessException } from '@libs/platform/exceptions'
import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common'
import { ForumCounterService } from '../../counter/forum-counter.service'
import { ForumTopicService } from '../forum-topic.service'

/**
 * 论坛主题收藏解析器
 * 负责处理论坛主题的收藏业务逻辑，包括验证主题存在性、更新收藏计数、发送通知等
 */
@Injectable()
export class ForumTopicFavoriteResolver
  implements IFavoriteTargetResolver, OnModuleInit
{
  /** 目标类型：论坛主题 */
  readonly targetType = FavoriteTargetTypeEnum.FORUM_TOPIC

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly favoriteService: FavoriteService,
    private readonly messageDomainEventPublisher: MessageDomainEventPublisherService,
    private readonly messageDomainEventFactoryService: MessageDomainEventFactoryService,
    private readonly forumCounterService: ForumCounterService,
    private readonly forumTopicService: ForumTopicService,
  ) {}

  /**
   * 模块初始化时注册解析器到收藏服务
   * 使收藏服务能够识别并处理论坛主题类型的收藏请求
   */
  onModuleInit() {
    this.favoriteService.registerResolver(this)
  }

  /**
   * 验证目标主题是否存在并返回主题所有者信息
   * @param tx - 事务客户端
   * @param targetId - 主题ID
   * @returns 包含主题所有者用户ID的对象
   * @throws BadRequestException 当主题不存在时抛出异常
   */
  async ensureExists(tx: Db, targetId: number) {
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
            isEnabled: true,
            deletedAt: true,
          },
        },
      },
    })

    if (
      !topic ||
      !topic.section ||
      topic.section.deletedAt ||
      !topic.section.isEnabled
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

  /**
   * 应用收藏计数增量
   * 当用户收藏或取消收藏时，更新主题的收藏计数
   * @param tx - 事务客户端
   * @param targetId - 主题ID
   * @param delta - 计数变化量（+1 表示收藏，-1 表示取消收藏）
   */
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

    await this.forumCounterService.updateTopicFavoriteRelatedCounts(
      tx,
      targetId,
      topic.userId,
      delta,
    )
  }

  /**
   * 收藏后钩子函数
   * 当用户成功收藏主题后，基于 ensureExists 已返回的属主与标题构造主题专属动态通知
   * @param tx - 事务客户端
   * @param targetId - 被收藏的主题ID
   * @param actorUserId - 执行收藏操作的用户ID
   * @param options - 收藏目标上下文，包含主题所有者与展示标题
   */
  async postFavoriteHook(
    tx: Db,
    targetId: number,
    actorUserId: number,
    options: FavoriteTargetContext,
  ) {
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

  /**
   * 批量获取主题详情
   * 用于在收藏列表中展示与主题分页项一致的详情字段
   * @param targetIds - 主题ID数组
   * @param userId - 当前用户ID，用于补充点赞/收藏状态
   * @returns 主题ID到主题详情的映射Map
   */
  async batchGetDetails(targetIds: number[], userId?: number) {
    return this.forumTopicService.batchGetFavoriteTopicDetails(
      targetIds,
      userId,
    )
  }
}
