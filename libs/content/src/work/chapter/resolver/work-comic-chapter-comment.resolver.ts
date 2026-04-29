import type { Db } from '@db/core'
import { DrizzleService } from '@db/core'

import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { CommentService } from '@libs/interaction/comment/comment.service'
import { ICommentTargetResolver } from '@libs/interaction/comment/interfaces/comment-target-resolver.interface'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { WorkCounterService } from '../../counter/work-counter.service'

/**
 * 漫画章节评论解析器
 */
@Injectable()
export class WorkComicChapterCommentResolver
  implements ICommentTargetResolver, OnModuleInit
{
  /** 目标类型：漫画章节 */
  readonly targetType = CommentTargetTypeEnum.COMIC_CHAPTER
  /** 作品类型：1 表示漫画 */
  private readonly workType = 1

  // 初始化 WorkComicChapterCommentResolver 依赖。
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly commentService: CommentService,
    private readonly workCounterService: WorkCounterService,
  ) {}

  // 作品章节表。
  private get workChapter() {
    return this.drizzle.schema.workChapter
  }

  // 作品作者关系表。
  private get workAuthorRelation() {
    return this.drizzle.schema.workAuthorRelation
  }

  // 模块初始化时注册解析器。
  onModuleInit() {
    this.commentService.registerResolver(this)
  }

  // 应用评论计数增量，更新漫画章节的评论数。
  async applyCountDelta(tx: Db, targetId: number, delta: number) {
    await this.workCounterService.updateWorkChapterCommentCount(
      tx,
      targetId,
      this.workType,
      delta,
      '漫画章节不存在',
    )
  }

  // 校验是否允许对该漫画章节发表评论，检查章节是否存在、是否允许评论。
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
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '漫画章节不存在',
      )
    }

    if (!chapter.canComment) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '该漫画章节不允许评论',
      )
    }
  }

  // 解析漫画章节的元信息，获取章节所属作品的作者ID，用于发送被评论通知。
  async resolveMeta(tx: Db, targetId: number) {
    const [author] = await tx
      .select({
        authorId: this.workAuthorRelation.authorId,
      })
      .from(this.workChapter)
      .innerJoin(
        this.workAuthorRelation,
        eq(this.workAuthorRelation.workId, this.workChapter.workId),
      )
      .where(eq(this.workChapter.id, targetId))
      .limit(1)

    return {
      ownerUserId: author?.authorId,
    }
  }
}
