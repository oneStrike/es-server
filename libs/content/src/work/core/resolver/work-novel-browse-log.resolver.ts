import { DrizzleService } from '@db/core'
import {
  BrowseLogService,
  BrowseLogTargetTypeEnum,
  IBrowseLogTargetResolver,
  InteractionTx,
} from '@libs/interaction'
import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'

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
  applyCountDelta: (
    tx: InteractionTx,
    targetId: number,
    delta: number,
  ) => Promise<void> = async (tx, targetId, delta) => {
    if (delta === 0) {
      return
    }

    await tx
      .update(this.work)
      .set({
        viewCount: sql`${this.work.viewCount} + ${delta}`,
      })
      .where(
        and(
          eq(this.work.id, targetId),
          eq(this.work.type, this.workType),
          isNull(this.work.deletedAt),
        ),
      )
  }

  /**
   * 校验小说作品是否有效
   *
   * @param tx - 事务客户端
   * @param targetId - 目标作品ID
   * @throws 当作品不存在时抛出 BadRequestException
   */
  ensureTargetValid: (
    tx: InteractionTx,
    targetId: number,
  ) => Promise<void> = async (tx, targetId) => {
    const work = await tx
      .select({ id: this.work.id })
      .from(this.work)
      .where(
        and(
          eq(this.work.id, targetId),
          eq(this.work.type, this.workType),
          isNull(this.work.deletedAt),
        ),
      )
      .limit(1)

    if (!work[0]) {
      throw new BadRequestException('小说作品不存在')
    }
  }
}
