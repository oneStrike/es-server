import type { Db } from '@db/core'
import { DrizzleService } from '@db/core'
import { appUser, userComment } from '@db/schema'
import {
  MessageNotificationSubjectTypeEnum,
  MessageNotificationTypeEnum,
} from '@libs/message/notification'
import { MessageOutboxService } from '@libs/message/outbox'
import { CommentLevelEnum } from '@libs/platform/constant'
import { AppUserCountService } from '@libs/user/index'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import {
  ILikeTargetResolver,
  LikeTargetMeta,
} from '../../like/interfaces/like-target-resolver.interface'
import { LikeTargetTypeEnum } from '../../like/like.constant'
import { LikeService } from '../../like/like.service'
import {
  CommentTargetTypeEnum,
  mapCommentTargetTypeToSceneType,
} from '../comment.constant'

/**
 * 评论点赞解析器
 * 负责处理评论的点赞业务逻辑，包括验证评论存在性、解析场景元数据（区分根评论和回复）、
 * 更新点赞计数、向评论作者发送通知等
 */
@Injectable()
export class CommentLikeResolver implements ILikeTargetResolver, OnModuleInit {
  /** 目标类型：评论 */
  readonly targetType = LikeTargetTypeEnum.COMMENT

  constructor(
    private readonly likeService: LikeService,
    private readonly messageOutboxService: MessageOutboxService,
    private readonly appUserCountService: AppUserCountService,
    private readonly drizzle: DrizzleService,
  ) {}

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
   * @param tx - 事务客户端
   * @param targetId - 评论ID
   * @returns 包含场景类型、场景ID和评论层级的元数据对象
   * @throws NotFoundException 当评论不存在时抛出异常
   * @throws BadRequestException 当评论挂载的目标类型不合法时抛出异常
   */
  async resolveMeta(tx: Db, targetId: number) {
    const comment = await tx.query.userComment.findFirst({
      where: { id: targetId, deletedAt: { isNull: true } },
      columns: {
        id: true,
        targetType: true,
        targetId: true,
        replyToId: true,
      },
    })

    if (!comment) {
      throw new NotFoundException('评论不存在')
    }

    const sceneType = mapCommentTargetTypeToSceneType(
      comment.targetType as CommentTargetTypeEnum,
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
   * @param tx - 事务客户端
   * @param targetId - 评论ID
   * @param delta - 计数变化量（+1 表示点赞，-1 表示取消点赞）
   */
  async applyCountDelta(tx: Db, targetId: number, delta: number) {
    if (delta === 0) {
      return
    }

    const updated = await tx
      .update(userComment)
      .set({
        likeCount: sql`${userComment.likeCount} + ${delta}`,
      })
      .where(and(eq(userComment.id, targetId), isNull(userComment.deletedAt)))
      .returning({ id: userComment.id, userId: userComment.userId })
    if (!updated[0]) {
      throw new NotFoundException('评论不存在')
    }

    await this.appUserCountService.updateCommentReceivedLikeCount(
      tx,
      updated[0].userId,
      delta,
    )
  }

  /**
   * 点赞后钩子函数
   * 当用户成功点赞评论后，向评论作者发送通知（点赞者与被点赞者不是同一人时）
   * @param tx - 事务客户端
   * @param targetId - 被点赞的评论ID
   * @param actorUserId - 执行点赞操作的用户ID
   * @param _meta - 点赞目标元数据（本场景未使用）
   */
  async postLikeHook(
    tx: Db,
    targetId: number,
    actorUserId: number,
    _meta: LikeTargetMeta,
  ) {
    const comment = await tx.query.userComment.findFirst({
      where: { id: targetId, deletedAt: { isNull: true } },
      columns: {
        id: true,
        userId: true,
        targetType: true,
        targetId: true,
      },
    })

    if (!comment || comment.userId === actorUserId) {
      return
    }

    await this.messageOutboxService.enqueueNotificationEventInTx(tx, {
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
    })
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

    const comments = await this.drizzle.db
      .select({
        id: userComment.id,
        floor: userComment.floor,
        content: userComment.content,
        createdAt: userComment.createdAt,
        userId: appUser.id,
        userNickname: appUser.nickname,
      })
      .from(userComment)
      .leftJoin(appUser, eq(userComment.userId, appUser.id))
      .where(
        and(inArray(userComment.id, targetIds), isNull(userComment.deletedAt)),
      )

    return new Map(
      comments.map((comment) => [
        comment.id,
        {
          id: comment.id,
          floor: comment.floor,
          content: comment.content,
          createdAt: comment.createdAt,
          user: comment.userId
            ? {
                id: comment.userId,
                nickname: comment.userNickname,
              }
            : null,
        },
      ]),
    )
  }
}
