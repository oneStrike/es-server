import type { PrismaTransactionClientType } from '@libs/platform/database'
import {
  BrowseLogService,
  BrowseLogTargetTypeEnum,
  IBrowseLogTargetResolver,
} from '@libs/interaction'
import { PlatformService } from '@libs/platform/database'
import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common'

/**
 * 小说作品浏览日志解析器
 * 处理小说作品的浏览记录相关操作
 */
@Injectable()
export class WorkNovelBrowseLogResolver
  extends PlatformService
  implements IBrowseLogTargetResolver, OnModuleInit
{
  /** 目标类型：小说作品 */
  readonly targetType = BrowseLogTargetTypeEnum.NOVEL
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
   * 更新小说作品的浏览数
   *
   * @param tx - Prisma 事务客户端
   * @param targetId - 目标作品ID
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

    await tx.work.applyCountDelta(
      {
        id: targetId,
        type: this.workType,
        deletedAt: null,
      },
      'viewCount',
      delta,
    )
  }

  /**
   * 校验小说作品是否有效
   *
   * @param tx - Prisma 事务客户端
   * @param targetId - 目标作品ID
   * @throws 当作品不存在时抛出 BadRequestException
   */
  ensureTargetValid: (
    tx: PrismaTransactionClientType,
    targetId: number,
  ) => Promise<void> = async (tx, targetId) => {
    const work = await tx.work.findFirst({
      where: {
        id: targetId,
        type: this.workType,
        deletedAt: null,
      },
      select: { id: true },
    })

    if (!work) {
      throw new BadRequestException('小说作品不存在')
    }
  }
}
