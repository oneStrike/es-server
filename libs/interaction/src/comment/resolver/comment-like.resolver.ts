import type { PrismaTransactionClientType } from '@libs/base/database/prisma.types'
import {
  CommentLevelEnum,
  InteractionTargetTypeEnum,
} from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import {
  mapInteractionTargetTypeToSceneType,
} from '@libs/interaction/interaction-target.definition'
import {
  ILikeTargetResolver,
  LikeTargetMeta,
} from '@libs/interaction/like/interfaces/like-target-resolver.interface'
import { LikeService } from '@libs/interaction/like/like.service'
import {
  MessageNotificationSubjectTypeEnum,
  MessageNotificationTypeEnum,
  MessageOutboxService,
} from '@libs/message'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'

@Injectable()
export class CommentLikeResolver
  extends BaseService
  implements ILikeTargetResolver, OnModuleInit
{
  readonly targetType = InteractionTargetTypeEnum.COMMENT

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
    const comment = await tx.userComment.findFirst({
      where: { id: targetId, deletedAt: null },
      select: {
        id: true,
        targetType: true,
        targetId: true,
        replyToId: true,
      },
    })

    if (!comment) {
      throw new NotFoundException('评论不存在')
    }

    if (comment.targetType === InteractionTargetTypeEnum.COMMENT) {
      throw new BadRequestException('评论不能继续挂载评论作为场景目标')
    }

    const sceneType = mapInteractionTargetTypeToSceneType(
      comment.targetType as InteractionTargetTypeEnum,
    )
    if (!sceneType) {
      throw new BadRequestException('评论挂载的目标类型不合法')
    }

    const commentLevel = comment.replyToId
      ? CommentLevelEnum.REPLY
      : CommentLevelEnum.ROOT

    return {
      sceneType,
      sceneId: comment.targetId,
      commentLevel,
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

    await tx.userComment.applyCountDelta(
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
    const comment = await tx.userComment.findFirst({
      where: { id: targetId, deletedAt: null },
      select: {
        id: true,
        userId: true,
        targetType: true,
        targetId: true,
      },
    })

    if (!comment || comment.userId === actorUserId) {
      return
    }

    await this.messageOutboxService.enqueueNotificationEvent(
      {
        eventType: MessageNotificationTypeEnum.COMMENT_LIKE,
        bizKey: `notify:comment:like:${comment.id}:actor:${actorUserId}:receiver:${comment.userId}`,
        payload: {
          receiverUserId: comment.userId,
          actorUserId,
          type: MessageNotificationTypeEnum.COMMENT_LIKE,
          targetType: comment.targetType,
          targetId: comment.targetId,
          subjectType: MessageNotificationSubjectTypeEnum.COMMENT,
          subjectId: comment.id,
          title: '你的评论收到点赞',
          content: '有人点赞了你的评论',
        },
      },
      tx,
    )
  }
}
