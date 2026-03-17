import { workAuthorRelation, workChapter } from '@db/schema'
import {
  CommentService,
  CommentTargetTypeEnum,
  ICommentTargetResolver,
  InteractionTx,
} from '@libs/interaction'
import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'

/**
 * 小说章节评论解析器
 */
@Injectable()
export class WorkNovelChapterCommentResolver
  implements ICommentTargetResolver, OnModuleInit
{
  /** 目标类型：小说章节 */
  readonly targetType = CommentTargetTypeEnum.NOVEL_CHAPTER
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
   * 更新小说章节的评论数
   *
   * @param tx - Prisma 事务客户端
   * @param targetId - 目标章节ID
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
      .update(workChapter)
      .set({
        commentCount: sql`${workChapter.commentCount} + ${delta}`,
      })
      .where(
        and(
          eq(workChapter.id, targetId),
          eq(workChapter.workType, this.workType),
          isNull(workChapter.deletedAt),
        ),
      )
    const updated = await tx.query.workChapter.findFirst({
      where: {
        id: targetId,
        workType: this.workType,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
    })
    if (!updated) {
      throw new BadRequestException('小说章节不存在')
    }
  }

  /**
   * 校验是否允许对该小说章节发表评论
   * 检查章节是否存在、是否允许评论
   *
   * @param tx - Prisma 事务客户端
   * @param targetId - 目标章节ID
   * @throws 当章节不存在或不允许评论时抛出 BadRequestException
   */
  async ensureCanComment(tx: InteractionTx, targetId: number) {
    const chapter = await tx.query.workChapter.findFirst({
      where: {
        id: targetId,
        workType: this.workType,
        deletedAt: { isNull: true },
      },
      columns: { canComment: true },
    })

    if (!chapter) {
      throw new BadRequestException('小说章节不存在')
    }

    if (!chapter.canComment) {
      throw new BadRequestException('该小说章节不允许评论')
    }
  }

  /**
   * 解析小说章节的元信息
   * 获取章节所属作品的作者ID，用于发送被评论通知
   *
   * @param tx - Prisma 事务客户端
   * @param targetId - 目标章节ID
   * @returns 目标元信息，包含所有者用户ID
   */
  async resolveMeta(tx: InteractionTx, targetId: number) {
    const [author] = await tx
      .select({
        authorId: workAuthorRelation.authorId,
      })
      .from(workChapter)
      .innerJoin(
        workAuthorRelation,
        eq(workAuthorRelation.workId, workChapter.workId),
      )
      .where(eq(workChapter.id, targetId))
      .limit(1)

    return {
      ownerUserId: author?.authorId,
    }
  }
}
