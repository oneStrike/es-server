import type { Db } from '@db/core'
import { DrizzleService } from '@db/core'
import { BrowseLogTargetTypeEnum } from '@libs/interaction/browse-log/browse-log.constant'
import { BrowseLogService } from '@libs/interaction/browse-log/browse-log.service'
import { IBrowseLogTargetResolver } from '@libs/interaction/browse-log/interfaces/browse-log-target-resolver.interface'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import { WorkCounterService } from '../../counter/work-counter.service'

/**
 * 小说作品浏览日志解析器
 * 处理小说作品的浏览记录相关操作
 */
@Injectable()
export class WorkNovelBrowseLogResolver
  implements IBrowseLogTargetResolver, OnModuleInit
{
  /** 目标类型：小说作品 */
  readonly targetType = BrowseLogTargetTypeEnum.NOVEL
  /** 作品类型：2 表示小说 */
  private readonly workType = 2

  constructor(
    private readonly browseLogService: BrowseLogService,
    private readonly drizzle: DrizzleService,
    private readonly workCounterService: WorkCounterService,
  ) {}

  private get work() {
    return this.drizzle.schema.work
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
   * @param tx - 事务客户端
   * @param targetId - 目标作品ID
   * @param delta - 变更量
   */
  applyCountDelta: (tx: Db, targetId: number, delta: number) => Promise<void> =
    async (tx, targetId, delta) => {
      await this.workCounterService.updateWorkViewCount(
        tx,
        targetId,
        this.workType,
        delta,
        '小说作品不存在',
      )
    }

  /**
   * 校验小说作品是否有效
   *
   * @param tx - 事务客户端
   * @param targetId - 目标作品ID
   * @throws 当作品不存在时抛出 BadRequestException
   */
  ensureTargetValid: (tx: Db, targetId: number) => Promise<void> = async (
    tx,
    targetId,
  ) => {
    const work = await tx
      .select({ id: this.work.id })
      .from(this.work)
      .where(
        and(
          eq(this.work.id, targetId),
          eq(this.work.type, this.workType),
          eq(this.work.isPublished, true),
          isNull(this.work.deletedAt),
        ),
      )
      .limit(1)

    if (!work[0]) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '小说作品不存在',
      )
    }
  }
}
