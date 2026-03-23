import type { Db } from '@db/core'
import {
  DrizzleService
 } from '@db/core'
import { work, workAuthorRelation } from '@db/schema'
import {
  CommentService,
  CommentTargetTypeEnum,
  ICommentTargetResolver,
} from '@libs/interaction/comment'
import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'

/**
 * 漫画作品评论解析器
 */
@Injectable()
export class WorkComicCommentResolver
  implements ICommentTargetResolver, OnModuleInit
{
  /** 目标类型：漫画作品 */
  readonly targetType = CommentTargetTypeEnum.COMIC
  /** 作品类型：1 表示漫画 */
  private readonly workType = 1

  constructor(
    private readonly commentService: CommentService,
    private readonly drizzle: DrizzleService,
  ) {}

  /**
   * 模块初始化时注册解析器
   */
  onModuleInit() {
    this.commentService.registerResolver(this)
  }

  /**
   * 应用评论计数增量
   * 更新漫画作品的评论数
   *
   * @param tx - 事务客户端
   * @param targetId - 目标作品ID
   * @param delta - 变更量（+1 增加，-1 减少）
   */
  async applyCountDelta(
    tx: Db,
    targetId: number,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }

    await this.drizzle.withErrorHandling(() =>
      tx
        .update(work)
        .set({
          commentCount: sql`${work.commentCount} + ${delta}`,
        })
        .where(
          and(
            eq(work.id, targetId),
            eq(work.type, this.workType),
            isNull(work.deletedAt),
          ),
        ),
    )
    const updated = await tx.query.work.findFirst({
      where: {
        id: targetId,
        type: this.workType,
        isPublished: true,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
    })
    if (!updated) {
      throw new BadRequestException('漫画作品不存在')
    }
  }

  /**
   * 校验是否允许对该漫画作品发表评论
   * 检查作品是否存在、是否允许评论
   *
   * @param tx - 事务客户端
   * @param targetId - 目标作品ID
   * @throws 当作品不存在或不允许评论时抛出 BadRequestException
   */
  async ensureCanComment(tx: Db, targetId: number) {
    const target = await tx.query.work.findFirst({
      where: {
        id: targetId,
        type: this.workType,
        deletedAt: { isNull: true },
      },
      columns: { canComment: true },
    })

    if (!target) {
      throw new BadRequestException('漫画作品不存在')
    }

    if (!target.canComment) {
      throw new BadRequestException('该漫画作品不允许评论')
    }
  }

  /**
   * 解析漫画作品的元信息
   * 获取作品作者ID，用于发送被评论通知
   *
   * @param tx - 事务客户端
   * @param targetId - 目标作品ID
   * @returns 目标元信息，包含所有者用户ID
   */
  async resolveMeta(tx: Db, targetId: number) {
    const [author] = await tx
      .select({
        authorId: workAuthorRelation.authorId,
      })
      .from(workAuthorRelation)
      .where(eq(workAuthorRelation.workId, targetId))
      .limit(1)

    return {
      ownerUserId: author?.authorId,
    }
  }
}
