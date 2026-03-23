import type { Db } from '@db/core'
import {
  DrizzleService
 } from '@db/core'
import {
  FavoriteService,
  FavoriteTargetTypeEnum,
  IFavoriteTargetResolver,
} from '@libs/interaction/favorite'
import { MessageNotificationTypeEnum } from '@libs/message/notification'
import { MessageOutboxService } from '@libs/message/outbox'
import { AuditStatusEnum } from '@libs/platform/constant'
import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'
import { ForumCounterService } from '../../counter/forum-counter.service'

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
    private readonly messageOutboxService: MessageOutboxService,
    private readonly forumCounterService: ForumCounterService,
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
      columns: { userId: true },
      with: {
        section: {
          columns: {
            isEnabled: true,
            deletedAt: true,
          },
        },
      },
    })

    if (!topic || !topic.section || topic.section.deletedAt || !topic.section.isEnabled) {
      throw new BadRequestException('帖子不存在')
    }

    return { ownerUserId: topic.userId }
  }

  /**
   * 应用收藏计数增量
   * 当用户收藏或取消收藏时，更新主题的收藏计数
   * @param tx - 事务客户端
   * @param targetId - 主题ID
   * @param delta - 计数变化量（+1 表示收藏，-1 表示取消收藏）
   */
  async applyCountDelta(
    tx: Db,
    targetId: number,
    delta: number,
  ) {
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
      throw new NotFoundException('帖子不存在')
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
   * 当用户成功收藏主题后，向主题作者发送通知（收藏者与被收藏者不是同一人时）
   * @param tx - 事务客户端
   * @param targetId - 被收藏的主题ID
   * @param actorUserId - 执行收藏操作的用户ID
   * @param options - 包含主题所有者用户ID的选项对象
   * @param options.ownerUserId - 主题所有者用户ID
   */
  async postFavoriteHook(
    tx: Db,
    targetId: number,
    actorUserId: number,
    options: { ownerUserId?: number },
  ) {
    const { ownerUserId: topicOwnerId } = options

    if (topicOwnerId !== undefined && topicOwnerId !== actorUserId) {
      await this.messageOutboxService.enqueueNotificationEventInTx(
        tx,
        {
          eventType: MessageNotificationTypeEnum.CONTENT_FAVORITE,
          bizKey: `notify:favorite:${this.targetType}:${targetId}:actor:${actorUserId}:receiver:${topicOwnerId}`,
          payload: {
            receiverUserId: topicOwnerId,
            actorUserId,
            type: MessageNotificationTypeEnum.CONTENT_FAVORITE,
            targetType: this.targetType,
            targetId,
            title: '你的内容被收藏了',
            content: '有人收藏了你的内容',
          },
        },
      )
    }
  }

  /**
   * 批量获取主题详情
   * 用于在收藏列表中展示主题的标题等基本信息
   * @param targetIds - 主题ID数组
   * @returns 主题ID到主题详情的映射Map
   */
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
      },
      with: {
        section: {
          columns: {
            isEnabled: true,
            deletedAt: true,
          },
        },
      },
    })

    const visibleTopics = topics.filter(
      (topic) => topic.section && !topic.section.deletedAt && topic.section.isEnabled,
    )

    return new Map(
      visibleTopics.map((topic) => [
        topic.id,
        {
          id: topic.id,
          title: topic.title,
        },
      ]),
    )
  }
}
