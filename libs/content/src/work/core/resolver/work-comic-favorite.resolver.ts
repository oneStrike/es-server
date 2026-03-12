import type { PrismaTransactionClientType } from '@libs/base/database'
import { BaseService } from '@libs/base/database'
import {
  FavoriteService,
  FavoriteTargetTypeEnum,
  IFavoriteTargetResolver,
} from '@libs/interaction/favorite'

import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common'

/**
 * 漫画作品收藏解析器
 * 负责处理漫画作品的收藏业务逻辑，包括验证作品存在性、更新收藏计数、批量获取作品详情等
 */
@Injectable()
export class WorkComicFavoriteResolver
  extends BaseService
  implements IFavoriteTargetResolver, OnModuleInit
{
  /** 目标类型：漫画作品 */
  readonly targetType = FavoriteTargetTypeEnum.WORK_COMIC

  constructor(private readonly favoriteService: FavoriteService) {
    super()
  }

  /**
   * 模块初始化时注册解析器到收藏服务
   * 使收藏服务能够识别并处理漫画作品类型的收藏请求
   */
  onModuleInit() {
    this.favoriteService.registerResolver(this)
  }

  /**
   * 验证目标漫画作品是否存在
   * @param tx - Prisma 事务客户端
   * @param targetId - 作品ID
   * @returns 空对象（收藏服务要求的接口规范）
   * @throws BadRequestException 当作品不存在时抛出异常
   */
  async ensureExists(tx: PrismaTransactionClientType, targetId: number) {
    const work = await tx.work.findFirst({
      where: {
        id: targetId,
        type: this.targetType,
        deletedAt: null,
      },
      select: { id: true },
    })

    if (!work) {
      throw new BadRequestException('漫画作品不存在')
    }

    return {}
  }

  /**
   * 应用收藏计数增量
   * 当用户收藏或取消收藏时，更新漫画作品的收藏计数
   * @param tx - Prisma 事务客户端
   * @param targetId - 作品ID
   * @param delta - 计数变化量（+1 表示收藏，-1 表示取消收藏）
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
        type: this.targetType,
        deletedAt: null,
      },
      'favoriteCount',
      delta,
    )
  }

  /**
   * 批量获取漫画作品详情
   * 用于在收藏列表中展示作品的名称、封面等基本信息
   * @param targetIds - 作品ID数组
   * @returns 作品ID到作品详情的映射Map
   */
  async batchGetDetails(targetIds: number[]) {
    if (targetIds.length === 0) {
      return new Map()
    }

    const works = await this.prisma.work.findMany({
      where: {
        id: { in: targetIds },
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        cover: true,
      },
    })

    return new Map(works.map((work) => [work.id, work]))
  }
}
