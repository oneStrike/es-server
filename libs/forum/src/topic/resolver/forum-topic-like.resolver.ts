import type { PrismaTransactionClientType } from '@libs/platform/database'
import {
  ILikeTargetResolver,
  LikeService,
  LikeTargetMeta,
  LikeTargetTypeEnum,
} from '@libs/interaction'
import {
  MessageNotificationTypeEnum,
  MessageOutboxService,
} from '@libs/message'
import { SceneTypeEnum } from '@libs/platform/constant'
import { PlatformService } from '@libs/platform/database'
import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'

/**
 * 论坛主题点赞解析器
 * 负责处理论坛主题的点赞业务逻辑，包括验证主题存在性、解析场景元数据、更新点赞计数、发送通知等
 */
@Injectable()
export class ForumTopicLikeResolver
  extends PlatformService
  implements ILikeTargetResolver, OnModuleInit
{
  /** 目标类型：论坛主题 */
  readonly targetType = LikeTargetTypeEnum.FORUM_TOPIC

  constructor(
    private readonly likeService: LikeService,
    private readonly messageOutboxService: MessageOutboxService,
  ) {
    super()
  }

  /**
   * 模块初始化时注册解析器到点赞服务
   * 使点赞服务能够识别并处理论坛主题类型的点赞请求
   */
  onModuleInit() {
    this.likeService.registerResolver(this)
  }

  /**
   * 解析目标主题的场景元数据
   * 验证主题存在性并返回场景类型和场景ID，用于统一交互记录的场景标识
   * @param tx - Prisma 事务客户端
   * @param targetId - 主题ID
   * @returns 包含场景类型和场景ID的元数据对象
   * @throws NotFoundException 当主题不存在时抛出异常
   */
  async resolveMeta(tx: PrismaTransactionClientType, targetId: number) {
    const topic = await tx.forumTopic.findFirst({
      where: {
        id: targetId,
        deletedAt: null,
      },
      select: { id: true },
    })

    if (!topic) {
      throw new NotFoundException('帖子不存在')
    }

    return {
      sceneType: SceneTypeEnum.FORUM_TOPIC,
      sceneId: targetId,
    }
  }

  /**
   * 应用点赞计数增量
   * 当用户点赞或取消点赞时，更新主题的点赞计数
   * @param tx - Prisma 事务客户端
   * @param targetId - 主题ID
   * @param delta - 计数变化量（+1 表示点赞，-1 表示取消点赞）
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
      'likeCount',
      delta,
    )
  }

  /**
   * 点赞后钩子函数
   * 当用户成功点赞主题后，向主题作者发送通知（点赞者与被点赞者不是同一人时）
   * @param tx - Prisma 事务客户端
   * @param targetId - 被点赞的主题ID
   * @param actorUserId - 执行点赞操作的用户ID
   * @param _meta - 点赞目标元数据（本场景未使用）
   */
  async postLikeHook(
    tx: PrismaTransactionClientType,
    targetId: number,
    actorUserId: number,
    _meta: LikeTargetMeta,
  ) {
    const topic = await tx.forumTopic.findFirst({
      where: {
        id: targetId,
        deletedAt: null,
      },
      select: { userId: true },
    })

    if (!topic || topic.userId === actorUserId) {
      return
    }

    await this.messageOutboxService.enqueueNotificationEvent(
      {
        eventType: MessageNotificationTypeEnum.COMMENT_LIKE,
        bizKey: `notify:like:${this.targetType}:${targetId}:actor:${actorUserId}:receiver:${topic.userId}`,
        payload: {
          receiverUserId: topic.userId,
          actorUserId,
          type: MessageNotificationTypeEnum.COMMENT_LIKE,
          targetType: this.targetType,
          targetId,
          title: '你的主题收到点赞',
          content: '有人点赞了你的主题',
        },
      },
      tx,
    )
  }
}
