import type { PrismaTransactionClientType } from '@libs/platform/database'
import { PlatformService } from '@libs/platform/database'
import {
  FavoriteService,
  FavoriteTargetTypeEnum,
  IFavoriteTargetResolver,
} from '@libs/interaction'

import {
  MessageNotificationTypeEnum,
  MessageOutboxService,
} from '@libs/message'
import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common'

/**
 * 论坛主题收藏解析器
 * 负责处理论坛主题的收藏业务逻辑，包括验证主题存在性、更新收藏计数、发送通知等
 */
@Injectable()
export class ForumTopicFavoriteResolver
  extends PlatformService
  implements IFavoriteTargetResolver, OnModuleInit
{
  /** 目标类型：论坛主题 */
  readonly targetType = FavoriteTargetTypeEnum.FORUM_TOPIC

  constructor(
    private readonly favoriteService: FavoriteService,
    private readonly messageOutboxService: MessageOutboxService,
  ) {
    super()
  }

  /**
   * 模块初始化时注册解析器到收藏服务
   * 使收藏服务能够识别并处理论坛主题类型的收藏请求
   */
  onModuleInit() {
    this.favoriteService.registerResolver(this)
  }

  /**
   * 验证目标主题是否存在并返回主题所有者信息
   * @param tx - Prisma 事务客户端
   * @param targetId - 主题ID
   * @returns 包含主题所有者用户ID的对象
   * @throws BadRequestException 当主题不存在时抛出异常
   */
  async ensureExists(tx: PrismaTransactionClientType, targetId: number) {
    const topic = await tx.forumTopic.findFirst({
      where: {
        id: targetId,
        isHidden: false,
        deletedAt: null,
      },
      select: { userId: true, isLocked: true, isHidden: true },
    })

    if (!topic) {
      throw new BadRequestException('帖子不存在')
    }

    return { ownerUserId: topic.userId }
  }

  /**
   * 应用收藏计数增量
   * 当用户收藏或取消收藏时，更新主题的收藏计数
   * @param tx - Prisma 事务客户端
   * @param targetId - 主题ID
   * @param delta - 计数变化量（+1 表示收藏，-1 表示取消收藏）
   */
  async applyCountDelta(
    tx: PrismaTransactionClientType,
    targetId: number,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }

    await tx.forumTopic.applyCountDelta(
      {
        id: targetId,
        deletedAt: null,
      },
      'favoriteCount',
      delta,
    )
  }

  /**
   * 收藏后钩子函数
   * 当用户成功收藏主题后，向主题作者发送通知（收藏者与被收藏者不是同一人时）
   * @param tx - Prisma 事务客户端
   * @param targetId - 被收藏的主题ID
   * @param actorUserId - 执行收藏操作的用户ID
   * @param options - 包含主题所有者用户ID的选项对象
   */
  async postFavoriteHook(
    tx: PrismaTransactionClientType,
    targetId: number,
    actorUserId: number,
    options: { ownerUserId?: number },
  ) {
    const { ownerUserId: topicOwnerId } = options

    if (topicOwnerId !== undefined && topicOwnerId !== actorUserId) {
      await this.messageOutboxService.enqueueNotificationEvent(
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
        tx,
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

    const topics = await this.prisma.forumTopic.findMany({
      where: {
        id: { in: targetIds },
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
      },
    })

    return new Map(topics.map((topic) => [topic.id, topic]))
  }
}
