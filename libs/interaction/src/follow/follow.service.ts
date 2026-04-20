import type { PostgresErrorSourceObject } from '@db/core'
import type { UserFollowSelect } from '@db/schema'
import type { IFollowTargetResolver } from './interfaces/follow-target-resolver.interface'
import { DrizzleService } from '@db/core'
import { AppUserCountService } from '@libs/user/app-user-count.service'
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import { and, eq, inArray } from 'drizzle-orm'
import { FollowPageCommandDto, FollowRecordDto } from './dto/follow.dto'
import { FollowGrowthService } from './follow-growth.service'
import { FollowTargetTypeEnum } from './follow.constant'

/**
 * 关注服务
 * 提供关注、取消关注、关系状态和关注列表等核心能力
 */
@Injectable()
export class FollowService {
  private readonly logger = new Logger(FollowService.name)
  private readonly resolvers = new Map<
    FollowTargetTypeEnum,
    IFollowTargetResolver
  >()

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

  private resolveErrorCode(
    error: Error | PostgresErrorSourceObject | null | undefined,
  ) {
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

  async follow(input: FollowRecordDto): Promise<Pick<UserFollowSelect, 'id'>> {
    const { targetType, targetId, userId } = input
    const resolver = this.getResolver(targetType)

    const record = await this.drizzle.withTransaction(async (tx) => {
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
        throw new InternalServerErrorException('关注失败')
      }

      await this.appUserCountService.updateFollowingCountByTargetType(
        tx,
        userId,
        targetType,
        1,
      )
      await resolver.applyCountDelta(tx, targetId, 1)

      if (resolver.postFollowHook) {
        await resolver.postFollowHook(tx, targetId, userId, {
          ownerUserId,
        })
      }
      return followRecord
    })

    await this.followGrowthService.rewardFollowCreated(
      targetType,
      targetId,
      userId,
    )
    return { id: record.id }
  }

  async unfollow(input: FollowRecordDto) {
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

      await this.appUserCountService.updateFollowingCountByTargetType(
        tx,
        userId,
        targetType,
        -1,
      )
      await resolver.applyCountDelta(tx, targetId, -1)
    })

    return true
  }

  async checkFollowStatus(input: FollowRecordDto): Promise<{
    isFollowing: boolean
    isFollowedByTarget: boolean
    isMutualFollow: boolean
  }> {
    const { targetType, targetId, userId } = input
    const isFollowing = await this.drizzle.ext.exists(
      this.userFollow,
      and(
        eq(this.userFollow.targetType, targetType),
        eq(this.userFollow.targetId, targetId),
        eq(this.userFollow.userId, userId),
      ),
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
      and(
        eq(this.userFollow.targetType, FollowTargetTypeEnum.USER),
        eq(this.userFollow.targetId, userId),
        eq(this.userFollow.userId, targetId),
      ),
    )

    return {
      isFollowing,
      isFollowedByTarget,
      isMutualFollow: isFollowing && isFollowedByTarget,
    }
  }

  /**
   * 按目标类型分页查询当前用户的关注记录。
   * 该方法只负责分页与详情聚合，不直接决定对外字段命名。
   */
  private async getFollowPageByTargetType(
    query: FollowPageCommandDto,
    targetType: FollowTargetTypeEnum,
  ) {
    const page = await this.drizzle.ext.findPagination(this.userFollow, {
      where: and(
        eq(this.userFollow.userId, query.userId),
        eq(this.userFollow.targetType, targetType),
      ),
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (page.list.length === 0) {
      return {
        page,
        detailMap: new Map<number, unknown>(),
      }
    }

    const targetIds = this.uniqueTargetIds(
      page.list.map((item) => item.targetId),
    )
    const resolver = this.getResolver(targetType)
    if (!resolver.batchGetDetails || targetIds.length === 0) {
      return {
        page,
        detailMap: new Map<number, unknown>(),
      }
    }

    const startedAt = Date.now()
    try {
      const detailMap = await resolver.batchGetDetails(targetIds)
      if (detailMap.size < targetIds.length) {
        this.logger.warn(
          `follow_detail_partial_missing targetType=${targetType} batchSize=${targetIds.length} resolvedSize=${detailMap.size} missingSize=${targetIds.length - detailMap.size} elapsedMs=${Date.now() - startedAt}`,
        )
      }
      return {
        page,
        detailMap,
      }
    } catch (error) {
      const drizzleError =
        error instanceof Error
          ? error
          : typeof error === 'object' && error !== null
            ? (error as PostgresErrorSourceObject)
            : undefined
      this.logger.warn(
        `follow_detail_resolve_failed targetType=${targetType} batchSize=${targetIds.length} elapsedMs=${Date.now() - startedAt} errorCode=${this.resolveErrorCode(drizzleError)} error=${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      return {
        page,
        detailMap: new Map<number, unknown>(),
      }
    }
  }

  /**
   * 分页查询指定用户关注的作者。
   */
  async getFollowedAuthorPage(query: FollowPageCommandDto) {
    const { page, detailMap } = await this.getFollowPageByTargetType(
      query,
      FollowTargetTypeEnum.AUTHOR,
    )

    return {
      ...page,
      list: page.list.map((item) => {
        const author = detailMap.get(item.targetId)
        if (!author || typeof author !== 'object') {
          return item
        }

        return {
          ...item,
          author: {
            ...(author as Record<string, unknown>),
            isFollowed: true,
          },
        }
      }),
    }
  }

  /**
   * 分页查询指定用户关注的论坛板块。
   */
  async getFollowedSectionPage(query: FollowPageCommandDto) {
    const { page, detailMap } = await this.getFollowPageByTargetType(
      query,
      FollowTargetTypeEnum.FORUM_SECTION,
    )

    return {
      ...page,
      list: page.list.map((item) => {
        const section = detailMap.get(item.targetId)
        if (!section || typeof section !== 'object') {
          return item
        }

        return {
          ...item,
          section: {
            ...(section as Record<string, unknown>),
            isFollowed: true,
          },
        }
      }),
    }
  }

  /**
   * 分页查询指定用户关注的用户。
   */
  async getFollowingUserPage(query: FollowPageCommandDto) {
    const page = await this.drizzle.ext.findPagination(this.userFollow, {
      where: and(
        eq(this.userFollow.userId, query.userId),
        eq(this.userFollow.targetType, FollowTargetTypeEnum.USER),
      ),
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

  /**
   * 分页查询关注指定用户的用户。
   */
  async getFollowerUserPage(query: FollowPageCommandDto) {
    const page = await this.drizzle.ext.findPagination(this.userFollow, {
      where: and(
        eq(this.userFollow.targetType, FollowTargetTypeEnum.USER),
        eq(this.userFollow.targetId, query.userId),
      ),
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
