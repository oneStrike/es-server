import { work, workAuthorRelation } from '@db/schema'
import {
  CommentService,
  CommentTargetTypeEnum,
  ICommentTargetResolver,
  InteractionTx,
} from '@libs/interaction'
import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'

/**
 * 小说作品评论解析器
 */
@Injectable()
export class WorkNovelCommentResolver
  implements ICommentTargetResolver, OnModuleInit
{
  /** 目标类型：小说作品 */
  readonly targetType = CommentTargetTypeEnum.NOVEL
  /** 作品类型：2 表示小说 */
  private readonly workType = 2

  constructor(private readonly commentService: CommentService) {}

  /**
   * 模块初始化时注册解析器
   */
  onModuleInit() {
    this.commentService.registerResolver(this)
  }

  /**
   * 应用评论计数增量
   * 更新小说作品的评论数
   *
   * @param tx - 事务客户端
   * @param targetId - 目标作品ID
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

    await tx
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
      )
    const updated = await tx.query.work.findFirst({
      where: {
        id: targetId,
        type: this.workType,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
    })
    if (!updated) {
      throw new BadRequestException('小说作品不存在')
    }
  }

  /**
   * 校验是否允许对该小说作品发表评论
   * 检查作品是否存在、是否允许评论
   *
   * @param tx - 事务客户端
   * @param targetId - 目标作品ID
   * @throws 当作品不存在或不允许评论时抛出 BadRequestException
   */
  async ensureCanComment(tx: InteractionTx, targetId: number) {
    const target = await tx.query.work.findFirst({
      where: {
        id: targetId,
        type: this.workType,
        deletedAt: { isNull: true },
      },
      columns: { canComment: true },
    })

    if (!target) {
      throw new BadRequestException('小说作品不存在')
    }

    if (!target.canComment) {
      throw new BadRequestException('该小说作品不允许评论')
    }
  }

  /**
   * 解析小说作品的元信息
   * 获取作品作者ID，用于发送被评论通知
   *
   * @param tx - 事务客户端
   * @param targetId - 目标作品ID
   * @returns 目标元信息，包含所有者用户ID
   */
  async resolveMeta(tx: InteractionTx, targetId: number) {
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
