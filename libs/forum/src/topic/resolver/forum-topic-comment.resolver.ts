import { DrizzleService } from '@db/core'
import { forumTopic } from '@db/schema'
import {
  CommentService,
  CommentTargetTypeEnum,
  ICommentTargetResolver,
  InteractionTx,
} from '@libs/interaction'
import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'

/**
 * 论坛帖子评论解析器
 * 处理论坛帖子的评论相关操作
 */
@Injectable()
export class ForumTopicCommentResolver
  implements ICommentTargetResolver, OnModuleInit
{
  /** 目标类型：论坛帖子 */
  readonly targetType = CommentTargetTypeEnum.FORUM_TOPIC

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly commentService: CommentService,
  ) {}

  /**
   * 模块初始化时注册解析器
   */
  onModuleInit() {
    this.commentService.registerResolver(this)
  }

  /**
   * 应用评论计数增量
   * 更新帖子的评论数
   *
   * @param tx - Prisma 事务客户端
   * @param targetId - 目标帖子ID
   * @param delta - 变更量（+1 增加，-1 减少）
   */
  async applyCountDelta(
    tx: InteractionTx,
    targetId: number,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }

    const result = await tx
      .update(forumTopic)
      .set({
        commentCount: sql`${forumTopic.commentCount} + ${delta}`,
      })
      .where(and(eq(forumTopic.id, targetId), isNull(forumTopic.deletedAt)))
    this.drizzle.assertAffectedRows(result, '帖子不存在')
  }

  /**
   * 校验是否允许对该帖子发表评论
   * 检查帖子是否存在、是否被锁定
   *
   * @param tx - Prisma 事务客户端
   * @param targetId - 目标帖子ID
   * @throws 当帖子不存在或被锁定时抛出 BadRequestException
   */
  async ensureCanComment(tx: InteractionTx, targetId: number) {
    const topic = await tx.query.forumTopic.findFirst({
      where: { id: targetId },
      columns: { isLocked: true, deletedAt: true },
    })

    if (!topic || topic.deletedAt !== null) {
      throw new BadRequestException('帖子不存在')
    }

    if (topic.isLocked) {
      throw new BadRequestException('帖子已被锁定，无法评论')
    }
  }

  /**
   * 解析帖子的元信息
   * 获取帖子作者ID，用于发送被评论通知
   *
   * @param tx - Prisma 事务客户端
   * @param targetId - 目标帖子ID
   * @returns 目标元信息，包含所有者用户ID
   */
  async resolveMeta(tx: InteractionTx, targetId: number) {
    const topic = await tx.query.forumTopic.findFirst({
      where: { id: targetId },
      columns: { userId: true },
    })

    return {
      ownerUserId: topic?.userId,
    }
  }
}
