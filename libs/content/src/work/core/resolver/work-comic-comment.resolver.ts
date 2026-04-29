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

  // 初始化 WorkComicCommentResolver 依赖。
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly commentService: CommentService,
    private readonly workCounterService: WorkCounterService,
  ) {}

  // 作品作者关系表。
  private get workAuthorRelation() {
    return this.drizzle.schema.workAuthorRelation
  }

  // 模块初始化时注册解析器。
  onModuleInit() {
    this.commentService.registerResolver(this)
  }

  // 应用评论计数增量，更新漫画作品的评论数。
  async applyCountDelta(tx: Db, targetId: number, delta: number) {
    await this.workCounterService.updateWorkCommentCount(
      tx,
      targetId,
      this.workType,
      delta,
      '漫画作品不存在',
    )
  }

  // 校验是否允许对该漫画作品发表评论，检查作品是否存在、是否允许评论。
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
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '漫画作品不存在',
      )
    }

    if (!target.canComment) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '该漫画作品不允许评论',
      )
    }
  }

  // 解析漫画作品的元信息，获取作品作者ID，用于发送被评论通知。
  async resolveMeta(tx: Db, targetId: number) {
    const [author] = await tx
      .select({
        authorId: this.workAuthorRelation.authorId,
      })
      .from(this.workAuthorRelation)
      .where(eq(this.workAuthorRelation.workId, targetId))
      .limit(1)

    return {
      ownerUserId: author?.authorId,
    }
  }
}
