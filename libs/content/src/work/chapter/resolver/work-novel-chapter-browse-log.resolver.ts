import type { PrismaTransactionClientType } from '@libs/platform/database'
import {
  BrowseLogService,
  BrowseLogTargetTypeEnum,
  IBrowseLogTargetResolver,
} from '@libs/interaction'
import { PlatformService } from '@libs/platform/database'
import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common'

/**
 * 小说章节浏览日志解析器
 * 处理小说章节的浏览记录相关操作
 */
@Injectable()
export class WorkNovelChapterBrowseLogResolver
  extends PlatformService
  implements IBrowseLogTargetResolver, OnModuleInit
{
  /** 目标类型：小说章节 */
  readonly targetType = BrowseLogTargetTypeEnum.NOVEL_CHAPTER
  /** 作品类型：2 表示小说 */
  private readonly workType = 2

  constructor(private readonly browseLogService: BrowseLogService) {
    super()
  }

  /**
   * 模块初始化时注册解析器
   */
  onModuleInit() {
    this.browseLogService.registerResolver(this)
  }

  /**
   * 应用浏览计数增量
   * 更新小说章节的浏览数
   *
   * @param tx - Prisma 事务客户端
   * @param targetId - 目标章节ID
   * @param delta - 变更量
   */
  applyCountDelta: (
    tx: PrismaTransactionClientType,
    targetId: number,
    delta: number,
  ) => Promise<void> = async (tx, targetId, delta) => {
    if (delta === 0) {
      return
    }

    await tx.workChapter.applyCountDelta(
      {
        id: targetId,
        workType: this.workType,
        deletedAt: null,
      },
      'viewCount',
      delta,
    )
  }

  /**
   * 校验小说章节是否有效
   *
   * @param tx - Prisma 事务客户端
   * @param targetId - 目标章节ID
   * @throws 当章节不存在时抛出 BadRequestException
   */
  ensureTargetValid: (
    tx: PrismaTransactionClientType,
    targetId: number,
  ) => Promise<void> = async (tx, targetId) => {
    const chapter = await tx.workChapter.findFirst({
      where: {
        id: targetId,
        workType: this.workType,
        deletedAt: null,
      },
      select: { id: true },
    })

    if (!chapter) {
      throw new BadRequestException('小说章节不存在')
    }
  }
}
