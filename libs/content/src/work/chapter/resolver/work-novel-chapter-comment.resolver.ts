import type { Db } from '@db/core'
import { workAuthorRelation, workChapter } from '@db/schema'
import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant';
import { CommentService } from '@libs/interaction/comment/comment.service';
import { ICommentTargetResolver } from '@libs/interaction/comment/interfaces/comment-target-resolver.interface';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { WorkCounterService } from '../../counter/work-counter.service'

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

  constructor(
    private readonly commentService: CommentService,
    private readonly workCounterService: WorkCounterService,
  ) {}

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
   * @param tx - 事务客户端
   * @param targetId - 目标章节ID
   * @param delta - 变更量（+1 增加，-1 减少）
   */
  async applyCountDelta(tx: Db, targetId: number, delta: number) {
    try {
      await this.workCounterService.updateWorkChapterCommentCount(
        tx,
        targetId,
        this.workType,
        delta,
        '小说章节不存在',
      )
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new BadRequestException(error.message)
      }
      throw error
    }
  }

  /**
   * 校验是否允许对该小说章节发表评论
   * 检查章节是否存在、是否允许评论
   *
   * @param tx - 事务客户端
   * @param targetId - 目标章节ID
   * @throws 当章节不存在或不允许评论时抛出 BadRequestException
   */
  async ensureCanComment(tx: Db, targetId: number) {
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
   * @param tx - 事务客户端
   * @param targetId - 目标章节ID
   * @returns 目标元信息，包含所有者用户ID
   */
  async resolveMeta(tx: Db, targetId: number) {
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
