import type { Db } from '@db/core'
import { DrizzleService } from '@db/core'
import {
  BrowseLogService,
  BrowseLogTargetTypeEnum,
  IBrowseLogTargetResolver,
} from '@libs/interaction/browse-log'
import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import { WorkCounterService } from '../../counter/work-counter.service'

/**
 * 漫画作品浏览日志解析器
 * 处理漫画作品的浏览记录相关操作
 */
@Injectable()
export class WorkComicBrowseLogResolver
  implements IBrowseLogTargetResolver, OnModuleInit
{
  /** 目标类型：漫画作品 */
  readonly targetType = BrowseLogTargetTypeEnum.COMIC
  /** 作品类型：1 表示漫画 */
  private readonly workType = 1

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
   * 更新漫画作品的浏览数
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
        '漫画作品不存在',
      )
    }

  /**
   * 校验漫画作品是否有效
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
      throw new NotFoundException('漫画作品不存在')
    }
  }
}
