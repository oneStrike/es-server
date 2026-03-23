import type { UserFollow } from '@db/schema'
import type {
  FollowListQuery,
  FollowRecordInput,
  FollowStatusView,
} from './follow.type'
import type { IFollowTargetResolver } from './interfaces/follow-target-resolver.interface'
import { DrizzleService } from '@db/core'
import { AppUserCountService } from '@libs/user'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { and, eq, inArray } from 'drizzle-orm'
import { FollowGrowthService } from './follow-growth.service'
import { FollowTargetTypeEnum } from './follow.constant'

/**
 * 关注服务
 * 提供关注、取消关注、关系状态和关注列表等核心能力
 */
@Injectable()
export class FollowService {
  private readonly logger = new Logger(FollowService.name)
  private readonly resolvers = new Map<FollowTargetTypeEnum, IFollowTargetResolver>()

  constructor(
    private readonly followGrowthService: FollowGrowthService,
    private readonly appUserCountService: AppUserCountService,
    private readonly drizzle: DrizzleService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get userFollow() {
    return this.drizzle.schema.userFollow
  }

  private uniqueTargetIds(targetIds: number[]) {
    return [...new Set(targetIds)]
  }

  private resolveErrorCode(error: unknown): string {
    return this.drizzle.extractError(error)?.code ?? 'unknown'
  }

  registerResolver(resolver: IFollowTargetResolver) {
    if (this.resolvers.has(resolver.targetType)) {
      console.warn(
        `Follow resolver for type ${resolver.targetType} is being overwritten.`,
      )
    }
    this.resolvers.set(resolver.targetType, resolver)
  }

  private getResolver(targetType: FollowTargetTypeEnum) {
    const resolver = this.resolvers.get(targetType)
    if (!resolver) {
      throw new BadRequestException(`不支持的关注类型: ${targetType}`)
    }
    return resolver
  }

  async checkStatusBatch(
    targetType: FollowTargetTypeEnum,
    targetIds: number[],
    userId: number,
  ) {
    if (targetIds.length === 0) {
      return new Map<number, boolean>()
    }

    const uniqueTargetIds = this.uniqueTargetIds(targetIds)
    const follows = await this.db
      .select({ targetId: this.userFollow.targetId })
      .from(this.userFollow)
      .where(
        and(
          eq(this.userFollow.targetType, targetType),
          inArray(this.userFollow.targetId, uniqueTargetIds),
          eq(this.userFollow.userId, userId),
        ),
      )

    const followedSet = new Set(follows.map((item) => item.targetId))
    const statusMap = new Map<number, boolean>()
    for (const targetId of uniqueTargetIds) {
      statusMap.set(targetId, followedSet.has(targetId))
    }
    return statusMap
  }

  private async checkUserFollowedByTargetBatch(
    currentUserId: number,
    targetUserIds: number[],
  ) {
    if (targetUserIds.length === 0) {
      return new Map<number, boolean>()
    }

    const uniqueTargetIds = this.uniqueTargetIds(targetUserIds)
    const follows = await this.db
      .select({ userId: this.userFollow.userId })
      .from(this.userFollow)
      .where(
        and(
          eq(this.userFollow.targetType, FollowTargetTypeEnum.USER),
          eq(this.userFollow.targetId, currentUserId),
          inArray(this.userFollow.userId, uniqueTargetIds),
        ),
      )

    const followedBySet = new Set(follows.map((item) => item.userId))
    const statusMap = new Map<number, boolean>()
    for (const targetUserId of uniqueTargetIds) {
      statusMap.set(targetUserId, followedBySet.has(targetUserId))
    }
    return statusMap
  }

  async follow(input: FollowRecordInput): Promise<Pick<UserFollow, 'id'>> {
    const { targetType, targetId, userId } = input
    const resolver = this.getResolver(targetType)

    const record = await this.drizzle.withTransaction(
      async (tx) => {
        const { ownerUserId } = await resolver.ensureExists(tx, targetId, userId)
        const rows = await this.drizzle.withErrorHandling(
          () =>
            tx
              .insert(this.userFollow)
              .values({
                targetType,
                targetId,
                userId,
              })
              .returning({
                id: this.userFollow.id,
              }),
          {
            duplicate: '无法重复关注',
          },
        )
        const followRecord = rows[0]
        if (!followRecord) {
          throw new BadRequestException('关注失败')
        }

        await this.appUserCountService.updateFollowingCount(tx, userId, 1)
        await resolver.applyCountDelta(tx, targetId, 1)

        if (resolver.postFollowHook) {
          await resolver.postFollowHook(tx, targetId, userId, {
            ownerUserId,
          })
        }
        return followRecord
      },
    )

    await this.followGrowthService.rewardFollowCreated(
      targetType,
      targetId,
      userId,
    )
    return { id: record.id }
  }

  async unfollow(input: FollowRecordInput) {
    const { targetType, targetId, userId } = input
    const resolver = this.getResolver(targetType)

    await this.drizzle.withTransaction(async (tx) => {
      const deleted = await tx
        .delete(this.userFollow)
        .where(
          and(
            eq(this.userFollow.targetType, targetType),
            eq(this.userFollow.targetId, targetId),
            eq(this.userFollow.userId, userId),
          ),
        )
      this.drizzle.assertAffectedRows(deleted, '关注记录不存在')

      await this.appUserCountService.updateFollowingCount(tx, userId, -1)
      await resolver.applyCountDelta(tx, targetId, -1)
    })

    return true
  }

  async checkFollowStatus(input: FollowRecordInput): Promise<FollowStatusView> {
    const { targetType, targetId, userId } = input
    const isFollowing = await this.drizzle.ext.exists(
      this.userFollow,
      this.drizzle.buildWhere(this.userFollow, {
        and: {
          targetType,
          targetId,
          userId,
        },
      }),
    )

    if (targetType !== FollowTargetTypeEnum.USER) {
      return {
        isFollowing,
        isFollowedByTarget: false,
        isMutualFollow: false,
      }
    }

    const isFollowedByTarget = await this.drizzle.ext.exists(
      this.userFollow,
      this.drizzle.buildWhere(this.userFollow, {
        and: {
          targetType: FollowTargetTypeEnum.USER,
          targetId: userId,
          userId: targetId,
        },
      }),
    )

    return {
      isFollowing,
      isFollowedByTarget,
      isMutualFollow: isFollowing && isFollowedByTarget,
    }
  }

  async getUserFollows(query: FollowListQuery) {
    const page = await this.drizzle.ext.findPagination(this.userFollow, {
      where: this.drizzle.buildWhere(this.userFollow, {
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

    const typeToIdsAggregator = new Map<FollowTargetTypeEnum, number[]>()
    for (const item of page.list) {
      if (!typeToIdsAggregator.has(item.targetType as FollowTargetTypeEnum)) {
        typeToIdsAggregator.set(item.targetType as FollowTargetTypeEnum, [])
      }
      typeToIdsAggregator.get(item.targetType as FollowTargetTypeEnum)!.push(
        item.targetId,
      )
    }

    const detailMaps = new Map<FollowTargetTypeEnum, Map<number, unknown>>()
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
                `follow_detail_partial_missing targetType=${type} batchSize=${uniqueIds.length} resolvedSize=${detailMap.size} missingSize=${uniqueIds.length - detailMap.size} elapsedMs=${Date.now() - startedAt}`,
              )
            }
          }
        } catch (error) {
          this.logger.warn(
            `follow_detail_resolve_failed targetType=${type} batchSize=${uniqueIds.length} elapsedMs=${Date.now() - startedAt} errorCode=${this.resolveErrorCode(error)} error=${
              error instanceof Error ? error.message : String(error)
            }`,
          )
        }
      }),
    )

    return {
      ...page,
      list: page.list.map((item) => {
        const targetDetail = detailMaps
          .get(item.targetType as FollowTargetTypeEnum)
          ?.get(item.targetId)
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

  async getMyFollowingUserPage(query: {
    userId: number
    pageIndex?: number
    pageSize?: number
  }) {
    const page = await this.drizzle.ext.findPagination(this.userFollow, {
      where: this.drizzle.buildWhere(this.userFollow, {
        and: {
          userId: query.userId,
          targetType: FollowTargetTypeEnum.USER,
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

    const targetUserIds = this.uniqueTargetIds(
      page.list.map((item) => item.targetId),
    )
    const userResolver = this.getResolver(FollowTargetTypeEnum.USER)
    const [detailMap, followedByMap] = await Promise.all([
      userResolver.batchGetDetails
        ? userResolver.batchGetDetails(targetUserIds)
        : Promise.resolve(new Map<number, unknown>()),
      this.checkUserFollowedByTargetBatch(query.userId, targetUserIds),
    ])

    return {
      ...page,
      list: page.list.map((item) => {
        const isFollowedByTarget = followedByMap.get(item.targetId) ?? false
        return {
          ...item,
          user: detailMap.get(item.targetId),
          isFollowing: true,
          isFollowedByTarget,
          isMutualFollow: isFollowedByTarget,
        }
      }),
    }
  }

  async getMyFollowerUserPage(query: {
    userId: number
    pageIndex?: number
    pageSize?: number
  }) {
    const page = await this.drizzle.ext.findPagination(this.userFollow, {
      where: this.drizzle.buildWhere(this.userFollow, {
        and: {
          targetType: FollowTargetTypeEnum.USER,
          targetId: query.userId,
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

    const followerUserIds = this.uniqueTargetIds(
      page.list.map((item) => item.userId),
    )
    const userResolver = this.getResolver(FollowTargetTypeEnum.USER)
    const [detailMap, followingMap] = await Promise.all([
      userResolver.batchGetDetails
        ? userResolver.batchGetDetails(followerUserIds)
        : Promise.resolve(new Map<number, unknown>()),
      this.checkStatusBatch(
        FollowTargetTypeEnum.USER,
        followerUserIds,
        query.userId,
      ),
    ])

    return {
      ...page,
      list: page.list.map((item) => {
        const isFollowing = followingMap.get(item.userId) ?? false
        return {
          ...item,
          user: detailMap.get(item.userId),
          isFollowing,
          isFollowedByTarget: true,
          isMutualFollow: isFollowing,
        }
      }),
    }
  }
}
