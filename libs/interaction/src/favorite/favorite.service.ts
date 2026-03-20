import type { UserFavorite } from '@db/schema'
import type {
  FavoriteListQuery,
  FavoriteRecordInput,
} from './favorite.type'
import { DrizzleService } from '@db/core'
import { AppUserCountService } from '@libs/user'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { and, eq, inArray } from 'drizzle-orm'
import { FavoriteGrowthService } from './favorite-growth.service'
import { FavoriteTargetTypeEnum } from './favorite.constant'
import { IFavoriteTargetResolver } from './interfaces/favorite-target-resolver.interface'

/**
 * 收藏服务
 * 提供收藏、取消收藏、查询收藏状态等核心业务逻辑
 */
@Injectable()
export class FavoriteService {
  private readonly logger = new Logger(FavoriteService.name)
  private readonly resolvers = new Map<
    FavoriteTargetTypeEnum,
    IFavoriteTargetResolver
  >()

  constructor(
    private readonly favoriteGrowthService: FavoriteGrowthService,
    private readonly appUserCountService: AppUserCountService,
    private readonly drizzle: DrizzleService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get userFavorite() {
    return this.drizzle.schema.userFavorite
  }

  private uniqueTargetIds(targetIds: number[]) {
    return [...new Set(targetIds)]
  }

  private resolveErrorCode(error: unknown): string {
    return this.drizzle.extractError(error)?.code ?? 'unknown'
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
    const uniqueTargetIds = this.uniqueTargetIds(targetIds)

    const favorites = await this.db
      .select({
        targetId: this.userFavorite.targetId,
      })
      .from(this.userFavorite)
      .where(
        and(
          eq(this.userFavorite.targetType, targetType),
          inArray(this.userFavorite.targetId, uniqueTargetIds),
          eq(this.userFavorite.userId, userId),
        ),
      )

    const favoritedSet = new Set(favorites.map((f) => f.targetId))
    const statusMap = new Map<number, boolean>()

    for (const targetId of uniqueTargetIds) {
      statusMap.set(targetId, favoritedSet.has(targetId))
    }

    return statusMap
  }

  /**
   * 收藏目标
   * @param input 收藏参数
   */
  async favorite(input: FavoriteRecordInput): Promise<Pick<UserFavorite, 'id'>> {
    const { targetType, targetId, userId } = input
    const resolver = this.getResolver(targetType)

    const record = await this.drizzle.withTransaction(async (tx) => {
      const { ownerUserId: topicOwnerId } = await resolver.ensureExists(
        tx,
        targetId,
      )
      const rows = await this.drizzle.withErrorHandling(
        () =>
          tx
            .insert(this.userFavorite)
            .values({
              targetType,
              targetId,
              userId,
            })
            .returning({
              id: this.userFavorite.id,
            }),
        {
          duplicate: '无法重复收藏',
        },
      )
      const favoriteRecord = rows[0] ?? null

      await this.appUserCountService.updateFavoriteCount(tx, userId, 1)
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
   * @param input 取消收藏参数
   */
  async unfavorite(input: FavoriteRecordInput) {
    const { targetType, targetId, userId } = input
    const resolver = this.getResolver(targetType)

    await this.drizzle.withTransaction(async (tx) => {
      const deleted = await tx
        .delete(this.userFavorite)
        .where(
          and(
            eq(this.userFavorite.targetType, targetType),
            eq(this.userFavorite.targetId, targetId),
            eq(this.userFavorite.userId, userId),
          ),
        )
      this.drizzle.assertAffectedRows(deleted, '收藏记录或用户不存在')

      await this.appUserCountService.updateFavoriteCount(tx, userId, -1)
      await resolver.applyCountDelta(tx, targetId, -1)
    })
  }

  /**
   * 检查单个目标收藏状态
   * @param input 查询参数
   * @returns 是否已收藏
   */
  async checkFavoriteStatus(input: FavoriteRecordInput): Promise<boolean> {
    const { targetType, targetId, userId } = input
    return this.drizzle.ext.exists(
      this.userFavorite,
      and(
        eq(this.userFavorite.targetType, targetType),
        eq(this.userFavorite.targetId, targetId),
        eq(this.userFavorite.userId, userId),
      ),
    )
  }

  /**
   * 获取用户收藏列表
   * @param query - 查询参数
   * @param query.targetType - 目标类型（可选）
   * @param query.pageIndex - 页码
   * @param query.pageSize - 每页数量
   * @param query.userId - 用户 ID
   * @returns 分页收藏列表
   */
  async getUserFavorites(query: FavoriteListQuery) {
    const page = await this.drizzle.ext.findPagination(this.userFavorite, {
      where: this.drizzle.buildWhere(this.userFavorite, {
        and: {
          userId: query.userId,
          targetType: query.targetType,
        },
      }),
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
      orderBy: {
        createdAt: 'desc',
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
    const detailMaps = new Map<FavoriteTargetTypeEnum, Map<number, unknown>>()
    await Promise.all(
      Array.from(typeToIdsAggregator.entries(), async ([type, ids]) => {
        const uniqueIds = this.uniqueTargetIds(ids)
        const startedAt = Date.now()
        try {
          const resolver = this.getResolver(type)
          if (resolver.batchGetDetails) {
            const detailMap = await resolver.batchGetDetails(uniqueIds)
            detailMaps.set(type, detailMap)
            if (detailMap.size < uniqueIds.length) {
              this.logger.warn(
                `favorite_detail_partial_missing targetType=${type} batchSize=${uniqueIds.length} resolvedSize=${detailMap.size} missingSize=${uniqueIds.length - detailMap.size} elapsedMs=${Date.now() - startedAt}`,
              )
            }
          }
        } catch (error) {
          this.logger.warn(
            `favorite_detail_resolve_failed targetType=${type} batchSize=${uniqueIds.length} elapsedMs=${Date.now() - startedAt} errorCode=${this.resolveErrorCode(error)} error=${
              error instanceof Error ? error.message : String(error)
            }`,
          )
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
            targetDetail,
          }
        }
        return item
      }),
    }
  }
}
