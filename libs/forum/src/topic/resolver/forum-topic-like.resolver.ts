import type { Db } from '@db/core'
import {
  DrizzleService
 } from '@db/core'
import {
  ILikeTargetResolver,
  LikeService,
  LikeTargetMeta,
  LikeTargetTypeEnum,
} from '@libs/interaction/like'
import { MessageNotificationComposerService } from '@libs/message/notification'
import { MessageOutboxService } from '@libs/message/outbox'
import { AuditStatusEnum, SceneTypeEnum } from '@libs/platform/constant'
import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'
import { ForumCounterService } from '../../counter/forum-counter.service'

/**
 * 论坛主题点赞解析器
 * 负责处理论坛主题的点赞业务逻辑，包括验证主题存在性、解析场景元数据、更新点赞计数、发送通知等
 */
@Injectable()
export class ForumTopicLikeResolver
  implements ILikeTargetResolver, OnModuleInit
{
  /** 目标类型：论坛主题 */
  readonly targetType = LikeTargetTypeEnum.FORUM_TOPIC

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly likeService: LikeService,
    private readonly messageOutboxService: MessageOutboxService,
    private readonly messageNotificationComposerService: MessageNotificationComposerService,
    private readonly forumCounterService: ForumCounterService,
  ) {}

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
   * @param tx - 事务客户端
   * @param targetId - 主题ID
   * @returns 包含场景类型和场景ID的元数据对象
   * @throws NotFoundException 当主题不存在时抛出异常
   */
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
            isEnabled: true,
            deletedAt: true,
          },
        },
      },
    })

    if (!topic || !topic.section || topic.section.deletedAt || !topic.section.isEnabled) {
      throw new NotFoundException('帖子不存在')
    }

    return {
      sceneType: SceneTypeEnum.FORUM_TOPIC,
      sceneId: targetId,
      ownerUserId: topic.userId,
      targetTitle: topic.title,
    }
  }

  /**
   * 应用点赞计数增量
   * 当用户点赞或取消点赞时，更新主题的点赞计数
   * @param tx - 事务客户端
   * @param targetId - 主题ID
   * @param delta - 计数变化量（+1 表示点赞，-1 表示取消点赞）
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

    await this.forumCounterService.updateTopicLikeRelatedCounts(
      tx,
      targetId,
      topic.userId,
      delta,
    )
  }

  /**
   * 点赞后钩子函数
   * 当用户成功点赞主题后，基于 resolveMeta 已透传的属主与标题构造主题专属动态通知
   * @param tx - 事务客户端
   * @param targetId - 被点赞的主题ID
   * @param actorUserId - 执行点赞操作的用户ID
   * @param meta - 点赞目标元数据，包含主题属主与展示标题
   */
  async postLikeHook(
    tx: Db,
    targetId: number,
    actorUserId: number,
    meta: LikeTargetMeta,
  ) {
    const receiverUserId = meta.ownerUserId
    if (!receiverUserId || receiverUserId === actorUserId) {
      return
    }

    const actor = await tx.query.appUser.findFirst({
      where: { id: actorUserId },
      columns: { nickname: true },
    })

    await this.messageOutboxService.enqueueNotificationEventInTx(
      tx,
      this.messageNotificationComposerService.buildTopicLikeEvent({
        bizKey: `notify:like:${this.targetType}:${targetId}:actor:${actorUserId}:receiver:${receiverUserId}`,
        receiverUserId,
        actorUserId,
        targetType: this.targetType,
        targetId,
        payload: {
          actorNickname: actor?.nickname?.trim() || '有人',
          topicTitle: meta.targetTitle?.trim() || '你的主题',
        },
      }),
    )
  }

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
          images: topic.images,
          videos: topic.videos,
        },
      ]),
    )
  }
}
