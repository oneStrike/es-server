import type { Db } from '@db/core'
import { DrizzleService } from '@db/core'
import { FavoriteTargetTypeEnum } from '@libs/interaction/favorite/favorite.constant'
import { FavoriteService } from '@libs/interaction/favorite/favorite.service'
import { IFavoriteTargetResolver } from '@libs/interaction/favorite/interfaces/favorite-target-resolver.interface'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { WorkCounterService } from '../../counter/work-counter.service'
import { WorkService } from '../work.service'

/**
 * 漫画作品收藏解析器
 * 负责处理漫画作品的收藏业务逻辑，包括验证作品存在性、更新收藏计数、批量获取作品详情等
 */
@Injectable()
export class WorkComicFavoriteResolver
  implements IFavoriteTargetResolver, OnModuleInit
{
  /** 目标类型：漫画作品 */
  readonly targetType = FavoriteTargetTypeEnum.WORK_COMIC

  // 初始化 WorkComicFavoriteResolver 依赖。
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly favoriteService: FavoriteService,
    private readonly workCounterService: WorkCounterService,
    private readonly workService: WorkService,
  ) {}

  // 读取 db。
  private get db() {
    return this.drizzle.db
  }

  // 模块初始化时注册解析器到收藏服务，使收藏服务能够识别并处理漫画作品类型的收藏请求。
  onModuleInit() {
    this.favoriteService.registerResolver(this)
  }

  // 验证目标漫画作品是否存在。
  async ensureExists(tx: Db, targetId: number) {
    const target = await tx.query.work.findFirst({
      where: {
        id: targetId,
        type: this.targetType,
        isPublished: true,
        deletedAt: { isNull: true },
      },
      columns: { id: true },
    })

    if (!target) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '漫画作品不存在',
      )
    }

    return {}
  }

  // 应用收藏计数增量，当用户收藏或取消收藏时，更新漫画作品的收藏计数。
  async applyCountDelta(tx: Db, targetId: number, delta: number) {
    await this.workCounterService.updateWorkFavoriteCount(
      tx,
      targetId,
      this.targetType,
      delta,
      '漫画作品不存在',
    )
  }

  // 批量获取漫画作品详情，用于在收藏列表中展示与作品分页项一致的详情字段。
  async batchGetDetails(targetIds: number[], userId?: number) {
    return this.workService.batchGetPageWorkDetails(
      targetIds,
      this.targetType,
      userId,
    )
  }
}
