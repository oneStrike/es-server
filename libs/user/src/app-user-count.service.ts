import type { Db, DbExecutor, SQL } from '@db/core'
import type { FollowTargetTypeEnum as FollowTargetType } from '@libs/interaction/follow/follow.type'
import type {
  AppUserCountField,
  AppUserCountSnapshot,
  AppUserFollowingCountAggregation,
} from './app-user-count.type'
import { DrizzleService } from '@db/core'
import { FavoriteTargetTypeEnum } from '@libs/interaction/favorite/favorite.constant'
import { FollowTargetTypeEnum } from '@libs/interaction/follow/follow.constant'
import { LikeTargetTypeEnum } from '@libs/interaction/like/like.constant'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, eq, gte, isNull, sql } from 'drizzle-orm'
import { AppUserCountDeltaFailureCauseCode } from './app-user-count.constant'

/**
 * 应用用户计数服务
 * 负责维护 app_user_count 的全局用户计数字段
 */
@Injectable()
export class AppUserCountService {
  constructor(private readonly drizzle: DrizzleService) {}

  // 复用共享数据库连接实例。
  private get db() {
    return this.drizzle.db
  }

  // 复用用户计数读模型表。
  private get appUserCount() {
    return this.drizzle.schema.appUserCount
  }

  // 复用用户关注事实表。
  private get userFollow() {
    return this.drizzle.schema.userFollow
  }

  // 复用用户点赞事实表。
  private get userLike() {
    return this.drizzle.schema.userLike
  }

  // 复用用户收藏事实表。
  private get userFavorite() {
    return this.drizzle.schema.userFavorite
  }

  // 复用用户评论事实表。
  private get userComment() {
    return this.drizzle.schema.userComment
  }

  // 复用论坛主题事实表。
  private get forumTopic() {
    return this.drizzle.schema.forumTopic
  }

  // 将 follow 表 targetType 映射为 app_user_count 的具体分项字段。
  // 若出现未知类型，抛出稳定业务异常，避免把计数写进错误字段。
  private resolveFollowingCountField(targetType: FollowTargetType) {
    switch (targetType) {
      case FollowTargetTypeEnum.USER:
        return 'followingUserCount'
      case FollowTargetTypeEnum.AUTHOR:
        return 'followingAuthorCount'
      case FollowTargetTypeEnum.FORUM_SECTION:
        return 'followingSectionCount'
      case FollowTargetTypeEnum.FORUM_HASHTAG:
        return 'followingHashtagCount'
      default:
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          `不支持的关注类型: ${targetType}`,
        )
    }
  }

  // 基于 follow 事实表聚合用户主动关注出去的分项数量。
  // 这里只统计 following 维度，不包含 followersCount。
  private async getFollowingCounts(
    client: Db,
    userId: number,
  ): Promise<AppUserFollowingCountAggregation> {
    const rows = await client
      .select({
        targetType: this.userFollow.targetType,
        count: sql<number>`count(*)::int`.mapWith(Number),
      })
      .from(this.userFollow)
      .where(eq(this.userFollow.userId, userId))
      .groupBy(this.userFollow.targetType)

    const counts: AppUserFollowingCountAggregation = {
      followingUserCount: 0,
      followingAuthorCount: 0,
      followingSectionCount: 0,
      followingHashtagCount: 0,
    }

    for (const row of rows) {
      const field = this.resolveFollowingCountField(row.targetType)
      counts[field] = Number(row.count ?? 0)
    }

    return counts
  }

  // 读取用户聚合计数读模型。
  // 若计数记录尚未初始化，统一返回 0，保证上层始终拿到稳定结构。
  async getUserCounts(userId: number): Promise<AppUserCountSnapshot> {
    const counts = await this.db
      .select({
        userId: this.appUserCount.userId,
        commentCount: this.appUserCount.commentCount,
        likeCount: this.appUserCount.likeCount,
        favoriteCount: this.appUserCount.favoriteCount,
        followingUserCount: this.appUserCount.followingUserCount,
        followingAuthorCount: this.appUserCount.followingAuthorCount,
        followingSectionCount: this.appUserCount.followingSectionCount,
        followingHashtagCount: this.appUserCount.followingHashtagCount,
        followersCount: this.appUserCount.followersCount,
        forumTopicCount: this.appUserCount.forumTopicCount,
        commentReceivedLikeCount: this.appUserCount.commentReceivedLikeCount,
        forumTopicReceivedLikeCount:
          this.appUserCount.forumTopicReceivedLikeCount,
        forumTopicReceivedFavoriteCount:
          this.appUserCount.forumTopicReceivedFavoriteCount,
      })
      .from(this.appUserCount)
      .where(eq(this.appUserCount.userId, userId))
      .limit(1)
      .then((rows) => rows[0])

    return {
      userId,
      commentCount: counts?.commentCount ?? 0,
      likeCount: counts?.likeCount ?? 0,
      favoriteCount: counts?.favoriteCount ?? 0,
      followingUserCount: counts?.followingUserCount ?? 0,
      followingAuthorCount: counts?.followingAuthorCount ?? 0,
      followingSectionCount: counts?.followingSectionCount ?? 0,
      followingHashtagCount: counts?.followingHashtagCount ?? 0,
      followersCount: counts?.followersCount ?? 0,
      forumTopicCount: counts?.forumTopicCount ?? 0,
      commentReceivedLikeCount: counts?.commentReceivedLikeCount ?? 0,
      forumTopicReceivedLikeCount: counts?.forumTopicReceivedLikeCount ?? 0,
      forumTopicReceivedFavoriteCount:
        counts?.forumTopicReceivedFavoriteCount ?? 0,
    }
  }

  // 初始化用户聚合计数读模型。
  // 新建用户时统一写入 0 值，避免后续增减路径反复补记录。
  async initUserCounts(tx: DbExecutor | undefined, userId: number) {
    const client = tx ?? this.db
    await client.insert(this.appUserCount).values({
      userId,
      commentCount: 0,
      likeCount: 0,
      favoriteCount: 0,
      followingUserCount: 0,
      followingAuthorCount: 0,
      followingSectionCount: 0,
      followingHashtagCount: 0,
      followersCount: 0,
      forumTopicCount: 0,
      commentReceivedLikeCount: 0,
      forumTopicReceivedLikeCount: 0,
      forumTopicReceivedFavoriteCount: 0,
    })
  }

  // 原子更新单个计数字段。
  // 统一处理 delta=0 短路、事务透传，以及“目标不存在/计数不足”的异常翻译。
  private async updateCountField(
    tx: DbExecutor | undefined,
    userId: number,
    field: AppUserCountField,
    delta: number,
    message: string = '用户计数不存在或计数不足',
  ) {
    if (delta === 0) {
      return
    }
    const execute = async (client: Db) =>
      this.applyUserCountDelta(
        client,
        eq(this.appUserCount.userId, userId),
        field,
        delta,
        message,
      )

    if (tx) {
      await execute(tx)
      return
    }
    await this.drizzle.withErrorHandling(async () => execute(this.db))
  }

  // 构建 app_user_count 单字段原子增减表达式，字段集合由 AppUserCountField 静态约束。
  private buildUserCountDelta(field: AppUserCountField, delta: number) {
    const amount = Math.abs(delta)
    switch (field) {
      case 'commentCount':
        return {
          column: this.appUserCount.commentCount,
          set: {
            commentCount:
              delta > 0
                ? sql`${this.appUserCount.commentCount} + ${amount}`
                : sql`${this.appUserCount.commentCount} - ${amount}`,
          },
        }
      case 'likeCount':
        return {
          column: this.appUserCount.likeCount,
          set: {
            likeCount:
              delta > 0
                ? sql`${this.appUserCount.likeCount} + ${amount}`
                : sql`${this.appUserCount.likeCount} - ${amount}`,
          },
        }
      case 'favoriteCount':
        return {
          column: this.appUserCount.favoriteCount,
          set: {
            favoriteCount:
              delta > 0
                ? sql`${this.appUserCount.favoriteCount} + ${amount}`
                : sql`${this.appUserCount.favoriteCount} - ${amount}`,
          },
        }
      case 'followingUserCount':
        return {
          column: this.appUserCount.followingUserCount,
          set: {
            followingUserCount:
              delta > 0
                ? sql`${this.appUserCount.followingUserCount} + ${amount}`
                : sql`${this.appUserCount.followingUserCount} - ${amount}`,
          },
        }
      case 'followingAuthorCount':
        return {
          column: this.appUserCount.followingAuthorCount,
          set: {
            followingAuthorCount:
              delta > 0
                ? sql`${this.appUserCount.followingAuthorCount} + ${amount}`
                : sql`${this.appUserCount.followingAuthorCount} - ${amount}`,
          },
        }
      case 'followingSectionCount':
        return {
          column: this.appUserCount.followingSectionCount,
          set: {
            followingSectionCount:
              delta > 0
                ? sql`${this.appUserCount.followingSectionCount} + ${amount}`
                : sql`${this.appUserCount.followingSectionCount} - ${amount}`,
          },
        }
      case 'followingHashtagCount':
        return {
          column: this.appUserCount.followingHashtagCount,
          set: {
            followingHashtagCount:
              delta > 0
                ? sql`${this.appUserCount.followingHashtagCount} + ${amount}`
                : sql`${this.appUserCount.followingHashtagCount} - ${amount}`,
          },
        }
      case 'followersCount':
        return {
          column: this.appUserCount.followersCount,
          set: {
            followersCount:
              delta > 0
                ? sql`${this.appUserCount.followersCount} + ${amount}`
                : sql`${this.appUserCount.followersCount} - ${amount}`,
          },
        }
      case 'forumTopicCount':
        return {
          column: this.appUserCount.forumTopicCount,
          set: {
            forumTopicCount:
              delta > 0
                ? sql`${this.appUserCount.forumTopicCount} + ${amount}`
                : sql`${this.appUserCount.forumTopicCount} - ${amount}`,
          },
        }
      case 'commentReceivedLikeCount':
        return {
          column: this.appUserCount.commentReceivedLikeCount,
          set: {
            commentReceivedLikeCount:
              delta > 0
                ? sql`${this.appUserCount.commentReceivedLikeCount} + ${amount}`
                : sql`${this.appUserCount.commentReceivedLikeCount} - ${amount}`,
          },
        }
      case 'forumTopicReceivedLikeCount':
        return {
          column: this.appUserCount.forumTopicReceivedLikeCount,
          set: {
            forumTopicReceivedLikeCount:
              delta > 0
                ? sql`${this.appUserCount.forumTopicReceivedLikeCount} + ${amount}`
                : sql`${this.appUserCount.forumTopicReceivedLikeCount} - ${amount}`,
          },
        }
      case 'forumTopicReceivedFavoriteCount':
        return {
          column: this.appUserCount.forumTopicReceivedFavoriteCount,
          set: {
            forumTopicReceivedFavoriteCount:
              delta > 0
                ? sql`${this.appUserCount.forumTopicReceivedFavoriteCount} + ${amount}`
                : sql`${this.appUserCount.forumTopicReceivedFavoriteCount} - ${amount}`,
          },
        }
    }
  }

  // 对用户计数执行原子增减；负数更新额外保护不允许扣成负数。
  private async applyUserCountDelta(
    client: Db,
    where: SQL,
    field: AppUserCountField,
    delta: number,
    message: string,
  ) {
    const amount = Math.abs(delta)
    const deltaQuery = this.buildUserCountDelta(field, delta)
    const updateWhere =
      delta > 0 ? where : and(where, gte(deltaQuery.column, amount))!
    const updated = await client
      .update(this.appUserCount)
      .set(deltaQuery.set)
      .where(updateWhere)
      .returning({ userId: this.appUserCount.userId })

    if (updated.length > 0) {
      return
    }

    const [existing] = await client
      .select({ userId: this.appUserCount.userId })
      .from(this.appUserCount)
      .where(where)
      .limit(1)
    const causeCode = existing
      ? AppUserCountDeltaFailureCauseCode.INSUFFICIENT_COUNT
      : AppUserCountDeltaFailureCauseCode.TARGET_NOT_FOUND

    throw new BusinessException(BusinessErrorCode.RESOURCE_NOT_FOUND, message, {
      cause: { code: causeCode },
    })
  }

  // 更新用户评论数。
  async updateCommentCount(
    tx: DbExecutor | undefined,
    userId: number,
    delta: number,
  ) {
    await this.updateCountField(tx, userId, 'commentCount', delta)
  }

  // 更新用户点赞数。
  async updateLikeCount(
    tx: DbExecutor | undefined,
    userId: number,
    delta: number,
  ) {
    await this.updateCountField(tx, userId, 'likeCount', delta)
  }

  // 更新用户收藏数。
  async updateFavoriteCount(
    tx: DbExecutor | undefined,
    userId: number,
    delta: number,
  ) {
    await this.updateCountField(tx, userId, 'favoriteCount', delta)
  }

  // 按关注目标类型更新用户发起关注分项数量。
  async updateFollowingCountByTargetType(
    tx: DbExecutor | undefined,
    userId: number,
    targetType: FollowTargetType,
    delta: number,
  ) {
    const field = this.resolveFollowingCountField(targetType)
    await this.updateCountField(tx, userId, field, delta)
  }

  // 更新用户粉丝数量。
  async updateFollowersCount(
    tx: DbExecutor | undefined,
    userId: number,
    delta: number,
  ) {
    await this.updateCountField(tx, userId, 'followersCount', delta)
  }

  // 根据 follow 事实表重建用户关注相关计数。
  // 仅回填关注分项与 followersCount，不改动其他计数字段。
  async rebuildFollowCounts(tx: DbExecutor | undefined, userId: number) {
    const client = tx ?? this.db
    const [followingCounts, followersRow] = await Promise.all([
      this.getFollowingCounts(client, userId),
      client
        .select({ count: sql<number>`count(*)::int`.mapWith(Number) })
        .from(this.userFollow)
        .where(
          and(
            eq(this.userFollow.targetType, FollowTargetTypeEnum.USER),
            eq(this.userFollow.targetId, userId),
          ),
        )
        .then((rows) => rows[0]),
    ])

    const followersCount = Number(followersRow?.count ?? 0)
    const persist = (executor: Db) =>
      executor
        .insert(this.appUserCount)
        .values({
          userId,
          ...followingCounts,
          followersCount,
        })
        .onConflictDoUpdate({
          target: this.appUserCount.userId,
          set: {
            ...followingCounts,
            followersCount,
            updatedAt: new Date(),
          },
        })

    if (tx) {
      await persist(tx)
    } else {
      await this.drizzle.withErrorHandling(() => persist(this.db))
    }

    return {
      userId,
      ...followingCounts,
      followersCount,
    }
  }

  // 根据事实表重建 app_user_count 的全部核心聚合字段。
  // 该方法以事实表为准，不依赖现有读模型值。
  async rebuildUserCounts(
    tx: DbExecutor | undefined,
    userId: number,
  ): Promise<AppUserCountSnapshot> {
    const client = tx ?? this.db
    const [
      commentRow,
      likeRow,
      favoriteRow,
      followingCounts,
      followersRow,
      forumTopicRow,
      commentReceivedLikeRow,
      forumTopicReceivedLikeRow,
      forumTopicReceivedFavoriteRow,
    ] = await Promise.all([
      client
        .select({ count: sql<number>`count(*)::int`.mapWith(Number) })
        .from(this.userComment)
        .where(
          and(
            eq(this.userComment.userId, userId),
            isNull(this.userComment.deletedAt),
          ),
        )
        .then((rows) => rows[0]),
      client
        .select({ count: sql<number>`count(*)::int`.mapWith(Number) })
        .from(this.userLike)
        .where(eq(this.userLike.userId, userId))
        .then((rows) => rows[0]),
      client
        .select({ count: sql<number>`count(*)::int`.mapWith(Number) })
        .from(this.userFavorite)
        .where(eq(this.userFavorite.userId, userId))
        .then((rows) => rows[0]),
      this.getFollowingCounts(client, userId),
      client
        .select({ count: sql<number>`count(*)::int`.mapWith(Number) })
        .from(this.userFollow)
        .where(
          and(
            eq(this.userFollow.targetType, FollowTargetTypeEnum.USER),
            eq(this.userFollow.targetId, userId),
          ),
        )
        .then((rows) => rows[0]),
      client
        .select({ count: sql<number>`count(*)::int`.mapWith(Number) })
        .from(this.forumTopic)
        .where(
          and(
            eq(this.forumTopic.userId, userId),
            isNull(this.forumTopic.deletedAt),
          ),
        )
        .then((rows) => rows[0]),
      client
        .select({ count: sql<number>`count(*)::int`.mapWith(Number) })
        .from(this.userLike)
        .innerJoin(
          this.userComment,
          and(
            eq(this.userComment.id, this.userLike.targetId),
            eq(this.userComment.userId, userId),
            isNull(this.userComment.deletedAt),
          ),
        )
        .where(eq(this.userLike.targetType, LikeTargetTypeEnum.COMMENT))
        .then((rows) => rows[0]),
      client
        .select({ count: sql<number>`count(*)::int`.mapWith(Number) })
        .from(this.userLike)
        .innerJoin(
          this.forumTopic,
          and(
            eq(this.forumTopic.id, this.userLike.targetId),
            eq(this.forumTopic.userId, userId),
            isNull(this.forumTopic.deletedAt),
          ),
        )
        .where(eq(this.userLike.targetType, LikeTargetTypeEnum.FORUM_TOPIC))
        .then((rows) => rows[0]),
      client
        .select({ count: sql<number>`count(*)::int`.mapWith(Number) })
        .from(this.userFavorite)
        .innerJoin(
          this.forumTopic,
          and(
            eq(this.forumTopic.id, this.userFavorite.targetId),
            eq(this.forumTopic.userId, userId),
            isNull(this.forumTopic.deletedAt),
          ),
        )
        .where(
          eq(this.userFavorite.targetType, FavoriteTargetTypeEnum.FORUM_TOPIC),
        )
        .then((rows) => rows[0]),
    ])

    const rebuiltCounts: AppUserCountSnapshot = {
      userId,
      commentCount: Number(commentRow?.count ?? 0),
      likeCount: Number(likeRow?.count ?? 0),
      favoriteCount: Number(favoriteRow?.count ?? 0),
      followingUserCount: followingCounts.followingUserCount,
      followingAuthorCount: followingCounts.followingAuthorCount,
      followingSectionCount: followingCounts.followingSectionCount,
      followingHashtagCount: followingCounts.followingHashtagCount,
      followersCount: Number(followersRow?.count ?? 0),
      forumTopicCount: Number(forumTopicRow?.count ?? 0),
      commentReceivedLikeCount: Number(commentReceivedLikeRow?.count ?? 0),
      forumTopicReceivedLikeCount: Number(
        forumTopicReceivedLikeRow?.count ?? 0,
      ),
      forumTopicReceivedFavoriteCount: Number(
        forumTopicReceivedFavoriteRow?.count ?? 0,
      ),
    }

    const persist = (executor: Db) =>
      executor
        .insert(this.appUserCount)
        .values(rebuiltCounts)
        .onConflictDoUpdate({
          target: this.appUserCount.userId,
          set: {
            ...rebuiltCounts,
            updatedAt: new Date(),
          },
        })

    if (tx) {
      await persist(tx)
    } else {
      await this.drizzle.withErrorHandling(() => persist(this.db))
    }

    return rebuiltCounts
  }

  // 更新用户论坛主题数。
  async updateForumTopicCount(
    tx: DbExecutor | undefined,
    userId: number,
    delta: number,
  ) {
    await this.updateCountField(tx, userId, 'forumTopicCount', delta)
  }

  // 更新用户评论收到的点赞数。
  async updateCommentReceivedLikeCount(
    tx: DbExecutor | undefined,
    userId: number,
    delta: number,
  ) {
    await this.updateCountField(tx, userId, 'commentReceivedLikeCount', delta)
  }

  // 更新用户论坛主题收到的点赞数。
  async updateForumTopicReceivedLikeCount(
    tx: DbExecutor | undefined,
    userId: number,
    delta: number,
  ) {
    await this.updateCountField(
      tx,
      userId,
      'forumTopicReceivedLikeCount',
      delta,
    )
  }

  // 更新用户论坛主题收到的收藏数。
  async updateForumTopicReceivedFavoriteCount(
    tx: DbExecutor | undefined,
    userId: number,
    delta: number,
  ) {
    await this.updateCountField(
      tx,
      userId,
      'forumTopicReceivedFavoriteCount',
      delta,
    )
  }
}
