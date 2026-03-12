import type { PrismaTransactionClientType } from '@libs/base/database/prisma.types'
import { InteractionTargetTypeEnum, SceneTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import {
  ILikeTargetResolver,
  LikeTargetMeta,
} from '@libs/interaction/like/interfaces/like-target-resolver.interface'
import { LikeService } from '@libs/interaction/like/like.service'
import {
  MessageNotificationTypeEnum,
  MessageOutboxService,
} from '@libs/message'
import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'

@Injectable()
export class ForumTopicLikeResolver
  extends BaseService
  implements ILikeTargetResolver, OnModuleInit
{
  readonly targetType = InteractionTargetTypeEnum.FORUM_TOPIC

  constructor(
    private readonly likeService: LikeService,
    private readonly messageOutboxService: MessageOutboxService,
  ) {
    super()
  }

  onModuleInit() {
    this.likeService.registerResolver(this)
  }

  async resolveMeta(
    tx: PrismaTransactionClientType,
    targetId: number,
  ) {
    const topic = await tx.forumTopic.findFirst({
      where: {
        id: targetId,
        deletedAt: null,
      },
      select: { id: true },
    })

    if (!topic) {
      throw new NotFoundException('目标不存在')
    }

    return {
      sceneType: SceneTypeEnum.FORUM_TOPIC,
      sceneId: targetId,
    }
  }

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
