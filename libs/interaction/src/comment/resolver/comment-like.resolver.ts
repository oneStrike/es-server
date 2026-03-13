import type { PrismaTransactionClientType } from '@libs/platform/database'
import {
  CommentLevelEnum,
  InteractionTargetTypeEnum,
} from '@libs/platform/constant'
import { PlatformService } from '@libs/platform/database'
import { mapInteractionTargetTypeToSceneType } from '../../interaction-target.definition'
import {
  ILikeTargetResolver,
  LikeTargetMeta,
} from '../../like/interfaces/like-target-resolver.interface'
import { LikeTargetTypeEnum } from '../../like/like.constant'
import { LikeService } from '../../like/like.service'
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

/**
 * 评论点赞解析器
 * 负责处理评论的点赞业务逻辑，包括验证评论存在性、解析场景元数据（区分根评论和回复）、
 * 更新点赞计数、向评论作者发送通知等
 */
@Injectable()
export class CommentLikeResolver
  extends PlatformService
  implements ILikeTargetResolver, OnModuleInit {
  /** 目标类型：评论 */
  readonly targetType = LikeTargetTypeEnum.COMMENT

  constructor(
    private readonly likeService: LikeService,
    private readonly messageOutboxService: MessageOutboxService,
  ) {
    super()
  }

  /**
   * 模块初始化时注册解析器到点赞服务
   * 使点赞服务能够识别并处理评论类型的点赞请求
   */
  onModuleInit() {
    this.likeService.registerResolver(this)
  }

  /**
   * 解析目标评论的场景元数据
   * 验证评论存在性，根据评论挂载的目标类型和回复关系确定场景类型和评论层级
   * @param tx - Prisma 事务客户端
   * @param targetId - 评论ID
   * @returns 包含场景类型、场景ID和评论层级的元数据对象
   * @throws NotFoundException 当评论不存在时抛出异常
   * @throws BadRequestException 当评论挂载的目标类型不合法时抛出异常
   */
  async resolveMeta(tx: PrismaTransactionClientType, targetId: number) {
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

    // 评论不能继续挂载评论作为场景目标，避免嵌套层级过深
    if (comment.targetType === InteractionTargetTypeEnum.COMMENT) {
      throw new BadRequestException('评论不能继续挂载评论作为场景目标')
    }

    const sceneType = mapInteractionTargetTypeToSceneType(
      comment.targetType as InteractionTargetTypeEnum,
    )
    if (!sceneType) {
      throw new BadRequestException('评论挂载的目标类型不合法')
    }

    // 根据 replyToId 判断评论层级：有回复ID则为回复评论，否则为根评论
    const commentLevel = comment.replyToId
      ? CommentLevelEnum.REPLY
      : CommentLevelEnum.ROOT

    return {
      sceneType,
      sceneId: comment.targetId,
      commentLevel,
    }
  }

  /**
   * 应用点赞计数增量
   * 当用户点赞或取消点赞时，更新评论的点赞计数
   * @param tx - Prisma 事务客户端
   * @param targetId - 评论ID
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

    await tx.userComment.applyCountDelta(
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
   * 当用户成功点赞评论后，向评论作者发送通知（点赞者与被点赞者不是同一人时）
   * @param tx - Prisma 事务客户端
   * @param targetId - 被点赞的评论ID
   * @param actorUserId - 执行点赞操作的用户ID
   * @param _meta - 点赞目标元数据（本场景未使用）
   */
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

  /**
   * 批量获取评论详情
   * 用于在点赞列表中展示评论的基本信息
   * @param targetIds - 作品ID数组
   * @returns 作品ID到作品详情的映射Map
   */
  async batchGetDetails(targetIds: number[]) {
    if (targetIds.length === 0) {
      return new Map()
    }

    const comments = await this.prisma.userComment.findMany({
      where: {
        id: { in: targetIds },
        deletedAt: null,
      },
      select: {
        id: true,
        floor: true,
        content: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            nickname: true
          }
        }
      },
    })

    return new Map(comments.map((comment) => [comment.id, comment]))
  }
}
