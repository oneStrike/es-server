import type { PrismaTransactionClientType } from '@libs/platform/database'
import {
  CommentService,
  CommentTargetTypeEnum,
  ICommentTargetResolver,
} from '@libs/interaction'
import { PlatformService } from '@libs/platform/database'
import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common'

/**
 * 漫画章节评论解析器
 */
@Injectable()
export class WorkComicChapterCommentResolver
  extends PlatformService
  implements ICommentTargetResolver, OnModuleInit
{
  /** 目标类型：漫画章节 */
  readonly targetType = CommentTargetTypeEnum.COMIC_CHAPTER
  /** 作品类型：1 表示漫画 */
  private readonly workType = 1

  constructor(private readonly commentService: CommentService) {
    super()
  }

  /**
   * 模块初始化时注册解析器
   */
  onModuleInit() {
    this.commentService.registerResolver(this)
  }

  /**
   * 应用评论计数增量
   * 更新漫画章节的评论数
   *
   * @param tx - Prisma 事务客户端
   * @param targetId - 目标章节ID
   * @param delta - 变更量（+1 增加，-1 减少）
   */
  async applyCountDelta(
    tx: PrismaTransactionClientType,
    targetId: number,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }

    await tx.workChapter.applyCountDelta(
      {
        id: targetId,
        workType: this.workType,
        deletedAt: null,
      },
      'commentCount',
      delta,
    )
  }

  /**
   * 校验是否允许对该漫画章节发表评论
   * 检查章节是否存在、是否允许评论
   *
   * @param tx - Prisma 事务客户端
   * @param targetId - 目标章节ID
   * @throws 当章节不存在或不允许评论时抛出 BadRequestException
   */
  async ensureCanComment(tx: PrismaTransactionClientType, targetId: number) {
    const chapter = await tx.workChapter.findFirst({
      where: {
        id: targetId,
        workType: this.workType,
        deletedAt: null
      },
      select: { canComment: true },
    })

    if (!chapter) {
      throw new BadRequestException('漫画章节不存在')
    }

    if (!chapter.canComment) {
      throw new BadRequestException('该漫画章节不允许评论')
    }
  }

  /**
   * 解析漫画章节的元信息
   * 获取章节所属作品的作者ID，用于发送被评论通知
   *
   * @param tx - Prisma 事务客户端
   * @param targetId - 目标章节ID
   * @returns 目标元信息，包含所有者用户ID
   */
  async resolveMeta(tx: PrismaTransactionClientType, targetId: number) {
    const chapter = await tx.workChapter.findUnique({
      where: { id: targetId },
      select: {
        work: {
          select: {
            authors: {
              take: 1,
            },
          },
        },
      },
    })

    return {
      ownerUserId: (chapter as any)?.work?.authors?.[0]?.authorId,
    }
  }
}
