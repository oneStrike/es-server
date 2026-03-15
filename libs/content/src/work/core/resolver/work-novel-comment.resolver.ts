import type { PrismaTransactionClientType } from '@libs/platform/database'
import {
  CommentService,
  CommentTargetTypeEnum,
  ICommentTargetResolver,
} from '@libs/interaction'
import { PlatformService } from '@libs/platform/database'
import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common'

/**
 * 小说作品评论解析器
 */
@Injectable()
export class WorkNovelCommentResolver
  extends PlatformService
  implements ICommentTargetResolver, OnModuleInit
{
  /** 目标类型：小说作品 */
  readonly targetType = CommentTargetTypeEnum.NOVEL
  /** 作品类型：2 表示小说 */
  private readonly workType = 2

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
   * 更新小说作品的评论数
   *
   * @param tx - Prisma 事务客户端
   * @param targetId - 目标作品ID
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

    await tx.work.applyCountDelta(
      {
        id: targetId,
        type: this.workType,
        deletedAt: null,
      },
      'commentCount',
      delta,
    )
  }

  /**
   * 校验是否允许对该小说作品发表评论
   * 检查作品是否存在、是否允许评论
   *
   * @param tx - Prisma 事务客户端
   * @param targetId - 目标作品ID
   * @throws 当作品不存在或不允许评论时抛出 BadRequestException
   */
  async ensureCanComment(tx: PrismaTransactionClientType, targetId: number) {
    const work = await tx.work.findFirst({
      where: {
        id: targetId,
        type: this.workType,
        deletedAt: null,
      },
      select: { canComment: true },
    })

    if (!work) {
      throw new BadRequestException('小说作品不存在')
    }

    if (!work.canComment) {
      throw new BadRequestException('该小说作品不允许评论')
    }
  }

  /**
   * 解析小说作品的元信息
   * 获取作品作者ID，用于发送被评论通知
   *
   * @param tx - Prisma 事务客户端
   * @param targetId - 目标作品ID
   * @returns 目标元信息，包含所有者用户ID
   */
  async resolveMeta(tx: PrismaTransactionClientType, targetId: number) {
    const work = await tx.work.findUnique({
      where: { id: targetId },
      include: {
        authors: {
          take: 1,
        },
      },
    })

    return {
      ownerUserId: work?.authors?.[0]?.authorId,
    }
  }
}
