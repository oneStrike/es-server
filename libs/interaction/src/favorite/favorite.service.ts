import { MessageOutboxService } from '@libs/message'
import { PlatformService, UserFavorite } from '@libs/platform/database'
import { BadRequestException, Injectable } from '@nestjs/common'
import { FavoritePageQueryDto } from './dto/favorite.dto'
import { FavoriteGrowthService } from './favorite-growth.service'
import { FavoriteTargetTypeEnum } from './favorite.constant'
import { IFavoriteTargetResolver } from './interfaces/favorite-target-resolver.interface'

/**
 * 收藏服务
 * 提供收藏、取消收藏、查询收藏状态等核心业务逻辑
 */
@Injectable()
export class FavoriteService extends PlatformService {
  /** 用户收藏 Prisma 代理 */
  get userFavorite() {
    return this.prisma.userFavorite
  }

  private readonly resolvers = new Map<
    FavoriteTargetTypeEnum,
    IFavoriteTargetResolver
  >()

  constructor(
    private readonly favoriteGrowthService: FavoriteGrowthService,
    private readonly messageOutboxService: MessageOutboxService,
  ) {
    super()
  }

  /**
   * 供其他模块在应用启动时注册自己的解析器
   */
  registerResolver(resolver: IFavoriteTargetResolver) {
    if (this.resolvers.has(resolver.targetType)) {
      console.warn(
        `Favorite resolver for type ${resolver.targetType} is being overwritten.`,
      )
    }
    this.resolvers.set(resolver.targetType, resolver)
  }

  /**
   * 获取对应的解析器
   */
  private getResolver(
    targetType: FavoriteTargetTypeEnum,
  ): IFavoriteTargetResolver {
    const resolver = this.resolvers.get(targetType)
    if (!resolver) {
      throw new BadRequestException(`不支持的收藏类型: ${targetType}`)
    }
    return resolver
  }

  /**
   * 批量检查收藏状态
   * @param targetType 目标类型
   * @param targetIds 目标 ID 列表
   * @param userId 用户 ID
   * @returns 目标 ID 与收藏状态的映射
   */
  async checkStatusBatch(
    targetType: FavoriteTargetTypeEnum,
    targetIds: number[],
    userId: number,
  ) {
    if (targetIds.length === 0) {
      return new Map()
    }

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

    const favoritedSet = new Set(favorites.map((f) => f.targetId))
    const statusMap = new Map<number, boolean>()

    for (const targetId of targetIds) {
      statusMap.set(targetId, favoritedSet.has(targetId))
    }

    return statusMap
  }

  /**
   * 收藏目标
   * @param targetType 目标类型
   * @param targetId 目标 ID
   * @param userId 用户 ID
   */
  async favorite(
    targetType: FavoriteTargetTypeEnum,
    targetId: number,
    userId: number,
  ) {
    const resolver = this.getResolver(targetType)

    const record = await this.prisma.$transaction(async (tx) => {
      const { ownerUserId: topicOwnerId } = await resolver.ensureExists(
        tx,
        targetId,
      )
      let favoriteRecord: null | UserFavorite = null
      try {
        favoriteRecord = await tx.userFavorite.create({
          data: {
            targetType,
            targetId,
            user: {
              connect: {
                id: userId,
              },
            },
          },
        })
      } catch (error) {
        // 唯一键冲突：已收藏
        this.handlePrismaBusinessError(error, {
          duplicateMessage: '无法重复收藏',
          notFoundMessage: '用户不存在',
        })
      }

      await resolver.applyCountDelta(tx, targetId, 1)

      if (resolver.postFavoriteHook) {
        await resolver.postFavoriteHook(tx, targetId, userId, {
          ownerUserId: topicOwnerId,
        })
      }
      return favoriteRecord
    })

    // 独立于主事务执行，防止崩溃或者过长影响核心数据落库
    await this.favoriteGrowthService.rewardFavoriteCreated(
      targetType,
      targetId,
      userId,
    )
    return { id: record.id }
  }

  /**
   * 取消收藏
   * @param targetType 目标类型
   * @param targetId 目标 ID
   * @param userId 用户 ID
   */
  async unfavorite(
    targetType: FavoriteTargetTypeEnum,
    targetId: number,
    userId: number,
  ) {
    const resolver = this.getResolver(targetType)

    await this.prisma.$transaction(async (tx) => {
      try {
        await tx.userFavorite.delete({
          where: {
            targetType_targetId_userId: {
              targetId,
              targetType,
              userId,
            },
          },
        })
      } catch (error) {
        this.handlePrismaBusinessError(error, {
          notFoundMessage: '收藏记录或用户不存在',
        })
      }

      await resolver.applyCountDelta(tx, targetId, -1)
    })
  }

  /**
   * 检查单个目标收藏状态
   * @param targetType 目标类型
   * @param targetId 目标 ID
   * @param userId 用户 ID
   * @returns 是否已收藏
   */
  async checkFavoriteStatus(
    targetType: FavoriteTargetTypeEnum,
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
   * @param dto - 查询参数
   * @param dto.targetType - 目标类型（可选）
   * @param dto.pageIndex - 页码
   * @param dto.pageSize - 每页数量
   * @param userId - 用户 ID
   * @returns 分页收藏列表
   */
  async getUserFavorites(dto: FavoritePageQueryDto, userId: number) {
    const page = await this.prisma.userFavorite.findPagination({
      where: {
        userId,
        ...dto,
      },
      select: {
        id: true,
        userId: true,
        targetId: true,
        targetType: true,
        createdAt: true,
      },
    })

    if (page.list.length === 0) {
      return page
    }

    // 按照 TargetType 分组收集 IDs
    const typeToIdsAggregator = new Map<FavoriteTargetTypeEnum, number[]>()
    for (const item of page.list) {
      if (!typeToIdsAggregator.has(item.targetType)) {
        typeToIdsAggregator.set(item.targetType, [])
      }
      typeToIdsAggregator.get(item.targetType)!.push(item.targetId)
    }

    // 并行调用各个 Resolver 获取详情
    const detailMaps = new Map<FavoriteTargetTypeEnum, Map<number, any>>()
    await Promise.all(
      Array.from(typeToIdsAggregator.entries(), async ([type, ids]) => {
        try {
          const resolver = this.getResolver(type)
          if (resolver.batchGetDetails) {
            const detailMap = await resolver.batchGetDetails(ids)
            detailMaps.set(type, detailMap)
          }
        } catch {
          // 忽略不支持的类型
        }
      }),
    )

    return {
      ...page,
      list: page.list.map((item) => {
        const targetDetail = detailMaps.get(item.targetType)?.get(item.targetId)
        if (targetDetail) {
          return {
            ...item,
            work: targetDetail, // 保持老前端兼容性或者视具体情况调整
            targetDetail,
          }
        }
        return item
      }),
    }
  }
}
