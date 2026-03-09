import { InteractionTargetTypeEnum } from '@libs/base/constant'
import { BaseService } from '@libs/base/database'
import { Injectable } from '@nestjs/common'
import { FavoriteGrowthService } from './favorite-growth.service'
import { FavoriteInteractionService } from './favorite-interaction.service'
import { FavoritePermissionService } from './favorite-permission.service'

/**
 * 收藏服务
 *
 * 提供用户收藏功能的核心业务逻辑，包括：
 * - 收藏/取消收藏操作
 * - 收藏状态检查
 * - 收藏列表查询
 * - 收藏计数更新
 *
 * 该服务协调以下子服务：
 * - FavoritePermissionService: 权限验证
 * - FavoriteInteractionService: 交互关联处理
 * - FavoriteGrowthService: 成长奖励发放
 */
@Injectable()
export class FavoriteService extends BaseService {
  constructor(
    private readonly favoritePermissionService: FavoritePermissionService,
    private readonly favoriteInteractionService: FavoriteInteractionService,
    private readonly favoriteGrowthService: FavoriteGrowthService,
  ) {
    super()
  }

  /**
   * 根据目标类型获取对应的 Prisma 模型
   *
   * @param client - Prisma 客户端或事务客户端
   * @param targetType - 交互目标类型
   * @returns 对应的 Prisma 模型
   * @throws 不支持的目标类型时抛出错误
   */
  private getTargetModel(client: any, targetType: InteractionTargetTypeEnum) {
    switch (targetType) {
      case InteractionTargetTypeEnum.COMIC:
      case InteractionTargetTypeEnum.NOVEL:
        return client.work
      case InteractionTargetTypeEnum.COMIC_CHAPTER:
      case InteractionTargetTypeEnum.NOVEL_CHAPTER:
        return client.workChapter
      case InteractionTargetTypeEnum.FORUM_TOPIC:
        return client.forumTopic
      case InteractionTargetTypeEnum.COMMENT:
        return client.userComment
      default:
        throw new Error(`Unsupported interaction target type: ${targetType}`)
    }
  }

  /**
   * 根据目标类型构建查询条件
   *
   * 不同类型的目标需要不同的查询条件：
   * - 漫画/小说：需要区分作品类型（type: 1 为漫画，type: 2 为小说）
   * - 章节：需要区分作品类型（workType: 1 为漫画章节，workType: 2 为小说章节）
   * - 其他：仅需 ID 条件
   *
   * @param targetType - 交互目标类型
   * @param targetId - 目标ID
   * @returns Prisma 查询条件对象
   * @throws 不支持的目标类型时抛出错误
   */
  private getTargetWhere(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
  ) {
    switch (targetType) {
      case InteractionTargetTypeEnum.COMIC:
        return { id: targetId, type: 1, deletedAt: null }
      case InteractionTargetTypeEnum.NOVEL:
        return { id: targetId, type: 2, deletedAt: null }
      case InteractionTargetTypeEnum.COMIC_CHAPTER:
        return { id: targetId, workType: 1, deletedAt: null }
      case InteractionTargetTypeEnum.NOVEL_CHAPTER:
        return { id: targetId, workType: 2, deletedAt: null }
      case InteractionTargetTypeEnum.FORUM_TOPIC:
      case InteractionTargetTypeEnum.COMMENT:
        return { id: targetId, deletedAt: null }
      default:
        throw new Error(`Unsupported interaction target type: ${targetType}`)
    }
  }

  /**
   * 对目标进行计数增量更新
   *
   * 使用 applyCountDelta 方法原子性地更新目标表的计数字段，
   * 避免并发问题。
   *
   * @param tx - 事务客户端
   * @param targetType - 交互目标类型
   * @param targetId - 目标ID
   * @param field - 要更新的计数字段名
   * @param delta - 增量值（正数为增加，负数为减少）
   */
  private async applyTargetCountDelta(
    tx: any,
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    field: string,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }

    const model = this.getTargetModel(tx, targetType)
    const where = this.getTargetWhere(targetType, targetId)
    await model.applyCountDelta(where, field, delta)
  }

  /**
   * 批量检查收藏状态
   *
   * 用于列表页面一次性检查多个目标是否已被当前用户收藏，
   * 避免多次数据库查询。
   *
   * @param targetType - 交互目标类型
   * @param targetIds - 目标ID数组
   * @param userId - 用户ID
   * @returns Map<目标ID, 是否已收藏>
   */
  async checkStatusBatch(
    targetType: InteractionTargetTypeEnum,
    targetIds: number[],
    userId: number,
  ): Promise<Map<number, boolean>> {
    if (targetIds.length === 0) {
      return new Map()
    }

    // 查询已收藏的目标
    const favorites = await this.prisma.userFavorite.findMany({
      where: {
        targetType,
        targetId: { in: targetIds },
        userId,
      },
      select: {
        targetId: true,
      },
    })

    // 构建已收藏目标的集合
    const favoritedSet = new Set(favorites.map((f) => f.targetId))
    const statusMap = new Map<number, boolean>()

    // 为每个目标设置收藏状态
    for (const targetId of targetIds) {
      statusMap.set(targetId, favoritedSet.has(targetId))
    }

    return statusMap
  }

  /**
   * 收藏目标
   *
   * 执行流程：
   * 1. 权限验证（确保用户可以收藏该目标）
   * 2. 创建收藏记录（事务内）
   * 3. 更新目标收藏计数（事务内）
   * 4. 处理交互关联（事务内）
   * 5. 发放成长奖励（事务外，失败不影响收藏）
   *
   * @param targetType - 交互目标类型
   * @param targetId - 目标ID
   * @param userId - 用户ID
   * @throws 已收藏时抛出重复错误
   */
  async favorite(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    userId: number,
  ): Promise<void> {
    // 验证用户是否有权限收藏该目标
    await this.favoritePermissionService.ensureCanFavorite(
      userId,
      targetType,
      targetId,
    )

    await this.prisma.$transaction(async (tx) => {
      // 创建收藏记录
      try {
        await tx.userFavorite.create({
          data: {
            targetType,
            targetId,
            userId,
          },
        })
      } catch (error) {
        this.handlePrismaBusinessError(error, {
          duplicateMessage: 'Already favorited',
        })
      }

      // 更新目标收藏计数 +1
      await this.applyTargetCountDelta(
        tx,
        targetType,
        targetId,
        'favoriteCount',
        1,
      )

      // 处理交互关联（如同步评论等）
      await this.favoriteInteractionService.handleFavoriteCreated(tx, {
        targetType,
        targetId,
        userId,
      })
    })

    // 发放成长奖励（积分、经验值）
    await this.favoriteGrowthService.rewardFavoriteCreated(
      targetType,
      targetId,
      userId,
    )
  }

  /**
   * 取消收藏
   *
   * 执行流程：
   * 1. 权限验证（确保用户可以取消收藏）
   * 2. 删除收藏记录（事务内）
   * 3. 更新目标收藏计数（事务内）
   *
   * @param targetType - 交互目标类型
   * @param targetId - 目标ID
   * @param userId - 用户ID
   * @throws 收藏记录不存在时抛出错误
   */
  async unfavorite(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    userId: number,
  ): Promise<void> {
    // 验证用户是否有权限取消收藏
    await this.favoritePermissionService.ensureCanUnfavorite(
      userId,
      targetType,
      targetId,
    )

    await this.prisma.$transaction(async (tx) => {
      // 删除收藏记录
      try {
        await tx.userFavorite.delete({
          where: {
            targetType_targetId_userId: {
              targetType,
              targetId,
              userId,
            },
          },
        })
      } catch (error) {
        this.handlePrismaBusinessError(error, {
          notFoundMessage: 'Favorite record not found',
        })
      }

      // 更新目标收藏计数 -1
      await this.applyTargetCountDelta(
        tx,
        targetType,
        targetId,
        'favoriteCount',
        -1,
      )
    })
  }

  /**
   * 检查单个目标的收藏状态
   *
   * @param targetType - 交互目标类型
   * @param targetId - 目标ID
   * @param userId - 用户ID
   * @returns 是否已收藏
   */
  async checkFavoriteStatus(
    targetType: InteractionTargetTypeEnum,
    targetId: number,
    userId: number,
  ): Promise<boolean> {
    const favorite = await this.prisma.userFavorite.findUnique({
      where: {
        targetType_targetId_userId: {
          targetType,
          targetId,
          userId,
        },
      },
      select: { id: true },
    })
    return !!favorite
  }

  /**
   * 获取用户收藏列表
   *
   * 支持按目标类型筛选，按创建时间倒序排列。
   *
   * @param userId - 用户ID
   * @param targetType - 可选的目标类型筛选
   * @param pageIndex - 页码，从0开始，默认为0
   * @param pageSize - 每页数量，默认为15
   * @returns 分页的收藏记录列表
   */
  async getUserFavorites(
    userId: number,
    targetType?: InteractionTargetTypeEnum,
    pageIndex: number = 0,
    pageSize: number = 15,
  ) {
    return this.prisma.userFavorite.findPagination({
      where: {
        userId,
        ...(targetType !== undefined && { targetType }),
        pageIndex,
        pageSize,
      } as any,
      orderBy: { createdAt: 'desc' },
      select: {
        targetId: true,
        targetType: true,
        createdAt: true,
      },
    })
  }
}
