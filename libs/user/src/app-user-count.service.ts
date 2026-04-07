import type { Db } from '@db/core'
import type {
  AppUserCountField,
  AppUserFollowingCountAggregation,
  RebuiltAppUserCountResult,
} from './app-user-count.type'
import { DrizzleService } from '@db/core'
import { applyCountDelta } from '@db/extensions'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'

/**
 * 应用用户计数服务
 * 负责维护 app_user_count 的全局用户计数字段
 */
@Injectable()
export class AppUserCountService {
  /**
   * 关注用户目标类型值。
   * 与 follow 模块解耦，避免用户域反向依赖 interaction follow 常量。
   */
  private readonly userFollowTargetType = 1
  private readonly authorFollowTargetType = 2
  private readonly forumSectionFollowTargetType = 3
  private readonly forumTopicLikeTargetType = 3
  private readonly forumTopicFavoriteTargetType = 3
  private readonly commentLikeTargetType = 6

  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get appUserCount() {
    return this.drizzle.schema.appUserCount
  }

  private get appUserFollow() {
    return this.drizzle.schema.appUserFollow
  }

  private get appUserLike() {
    return this.drizzle.schema.appUserLike
  }

  private get appUserFavorite() {
    return this.drizzle.schema.appUserFavorite
  }

  private get appUserComment() {
    return this.drizzle.schema.appUserComment
  }

  private get forumTopic() {
    return this.drizzle.schema.forumTopic
  }

  /**
   * 将 follow 表 targetType 映射为 app_user_count 的具体分项字段。
   * 若出现未知类型，直接抛出业务异常，避免把计数写进错误字段。
   */
  private resolveFollowingCountField(targetType: number) {
    switch (targetType) {
      case this.userFollowTargetType:
        return 'followingUserCount'
      case this.authorFollowTargetType:
        return 'followingAuthorCount'
      case this.forumSectionFollowTargetType:
        return 'followingSectionCount'
      default:
        throw new BadRequestException(`不支持的关注类型: ${targetType}`)
    }
  }

  /**
   * 基于 follow 事实表聚合用户主动关注出去的分项数量。
   * 这里只统计 following 维度，不包含 followersCount。
   */
  private async getFollowingCounts(
    client: Db,
    userId: number,
  ): Promise<AppUserFollowingCountAggregation> {
    const rows = await client
      .select({
        targetType: this.appUserFollow.targetType,
        count: sql<number>`count(*)::int`,
      })
      .from(this.appUserFollow)
      .where(eq(this.appUserFollow.userId, userId))
      .groupBy(this.appUserFollow.targetType)

    const counts: AppUserFollowingCountAggregation = {
      followingUserCount: 0,
      followingAuthorCount: 0,
      followingSectionCount: 0,
    }

    for (const row of rows) {
      const field = this.resolveFollowingCountField(row.targetType)
      counts[field] = Number(row.count ?? 0)
    }

    return counts
  }

  /**
   * 读取用户聚合计数读模型。
   * 若计数记录尚未初始化，统一返回 0，保证上层始终拿到稳定结构。
   */
  async getUserCounts(userId: number) {
    const counts = await this.db
      .select({
        userId: this.appUserCount.userId,
        commentCount: this.appUserCount.commentCount,
        likeCount: this.appUserCount.likeCount,
        favoriteCount: this.appUserCount.favoriteCount,
        followingUserCount: this.appUserCount.followingUserCount,
        followingAuthorCount: this.appUserCount.followingAuthorCount,
        followingSectionCount: this.appUserCount.followingSectionCount,
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
      followersCount: counts?.followersCount ?? 0,
      forumTopicCount: counts?.forumTopicCount ?? 0,
      commentReceivedLikeCount: counts?.commentReceivedLikeCount ?? 0,
      forumTopicReceivedLikeCount: counts?.forumTopicReceivedLikeCount ?? 0,
      forumTopicReceivedFavoriteCount:
        counts?.forumTopicReceivedFavoriteCount ?? 0,
    }
  }

  /**
   * 初始化用户聚合计数读模型。
   * 新建用户时统一写入 0 值，避免后续增减路径反复补记录。
   */
  async initUserCounts(tx: Db | undefined, userId: number) {
    const client = tx ?? this.db
    await client.insert(this.appUserCount).values({
      userId,
      commentCount: 0,
      likeCount: 0,
      favoriteCount: 0,
      followingUserCount: 0,
      followingAuthorCount: 0,
      followingSectionCount: 0,
      followersCount: 0,
      forumTopicCount: 0,
      commentReceivedLikeCount: 0,
      forumTopicReceivedLikeCount: 0,
      forumTopicReceivedFavoriteCount: 0,
    })
  }

  /**
   * 原子更新单个计数字段。
   * 统一处理 delta=0 短路、事务透传，以及“目标不存在/计数不足”的异常翻译。
   */
  private async updateCountField(
    tx: Db | undefined,
    userId: number,
    field: AppUserCountField,
    delta: number,
    message: string = '用户计数不存在或计数不足',
  ) {
    if (delta === 0) {
      return
    }
    const execute = async (client: Db) =>
      applyCountDelta(
        client,
        this.appUserCount,
        eq(this.appUserCount.userId, userId),
        field,
        delta,
      )

    try {
      if (tx) {
        await execute(tx)
        return
      }
      await this.drizzle.withErrorHandling(async () => execute(this.db))
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(message)
      }
      throw error
    }
  }

  /**
   * 更新用户评论数。
   */
  async updateCommentCount(tx: Db | undefined, userId: number, delta: number) {
    await this.updateCountField(tx, userId, 'commentCount', delta)
  }

  /**
   * 更新用户点赞数。
   */
  async updateLikeCount(tx: Db | undefined, userId: number, delta: number) {
    await this.updateCountField(tx, userId, 'likeCount', delta)
  }

  /**
   * 更新用户收藏数。
   */
  async updateFavoriteCount(tx: Db | undefined, userId: number, delta: number) {
    await this.updateCountField(tx, userId, 'favoriteCount', delta)
  }

  /**
   * 按关注目标类型更新用户发起关注分项数量
   */
  async updateFollowingCountByTargetType(
    tx: Db | undefined,
    userId: number,
    targetType: number,
    delta: number,
  ) {
    const field = this.resolveFollowingCountField(targetType)
    await this.updateCountField(tx, userId, field, delta)
  }

  /**
   * 更新用户粉丝数量。
   */
  async updateFollowersCount(
    tx: Db | undefined,
    userId: number,
    delta: number,
  ) {
    await this.updateCountField(tx, userId, 'followersCount', delta)
  }

  /**
   * 根据 follow 事实表重建用户关注相关计数。
   * 仅回填关注分项与 followersCount，不改动其他计数字段。
   */
  async rebuildFollowCounts(tx: Db | undefined, userId: number) {
    const client = tx ?? this.db
    const [followingCounts, followersRow] = await Promise.all([
      this.getFollowingCounts(client, userId),
      client
        .select({ count: sql<number>`count(*)::int` })
        .from(this.appUserFollow)
        .where(
          and(
            eq(this.appUserFollow.targetType, this.userFollowTargetType),
            eq(this.appUserFollow.targetId, userId),
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

  /**
   * 根据事实表重建 app_user_count 的全部核心聚合字段。
   * 该方法以事实表为准，不依赖现有读模型值。
   */
  async rebuildUserCounts(
    tx: Db | undefined,
    userId: number,
  ): Promise<RebuiltAppUserCountResult> {
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
        .select({ count: sql<number>`count(*)::int` })
        .from(this.appUserComment)
        .where(
          and(
            eq(this.appUserComment.userId, userId),
            isNull(this.appUserComment.deletedAt),
          ),
        )
        .then((rows) => rows[0]),
      client
        .select({ count: sql<number>`count(*)::int` })
        .from(this.appUserLike)
        .where(eq(this.appUserLike.userId, userId))
        .then((rows) => rows[0]),
      client
        .select({ count: sql<number>`count(*)::int` })
        .from(this.appUserFavorite)
        .where(eq(this.appUserFavorite.userId, userId))
        .then((rows) => rows[0]),
      this.getFollowingCounts(client, userId),
      client
        .select({ count: sql<number>`count(*)::int` })
        .from(this.appUserFollow)
        .where(
          and(
            eq(this.appUserFollow.targetType, this.userFollowTargetType),
            eq(this.appUserFollow.targetId, userId),
          ),
        )
        .then((rows) => rows[0]),
      client
        .select({ count: sql<number>`count(*)::int` })
        .from(this.forumTopic)
        .where(
          and(
            eq(this.forumTopic.userId, userId),
            isNull(this.forumTopic.deletedAt),
          ),
        )
        .then((rows) => rows[0]),
      client
        .select({ count: sql<number>`count(*)::int` })
        .from(this.appUserLike)
        .innerJoin(
          this.appUserComment,
          and(
            eq(this.appUserComment.id, this.appUserLike.targetId),
            eq(this.appUserComment.userId, userId),
            isNull(this.appUserComment.deletedAt),
          ),
        )
        .where(eq(this.appUserLike.targetType, this.commentLikeTargetType))
        .then((rows) => rows[0]),
      client
        .select({ count: sql<number>`count(*)::int` })
        .from(this.appUserLike)
        .innerJoin(
          this.forumTopic,
          and(
            eq(this.forumTopic.id, this.appUserLike.targetId),
            eq(this.forumTopic.userId, userId),
            isNull(this.forumTopic.deletedAt),
          ),
        )
        .where(eq(this.appUserLike.targetType, this.forumTopicLikeTargetType))
        .then((rows) => rows[0]),
      client
        .select({ count: sql<number>`count(*)::int` })
        .from(this.appUserFavorite)
        .innerJoin(
          this.forumTopic,
          and(
            eq(this.forumTopic.id, this.appUserFavorite.targetId),
            eq(this.forumTopic.userId, userId),
            isNull(this.forumTopic.deletedAt),
          ),
        )
        .where(
          eq(this.appUserFavorite.targetType, this.forumTopicFavoriteTargetType),
        )
        .then((rows) => rows[0]),
    ])

    const rebuiltCounts: RebuiltAppUserCountResult = {
      userId,
      commentCount: Number(commentRow?.count ?? 0),
      likeCount: Number(likeRow?.count ?? 0),
      favoriteCount: Number(favoriteRow?.count ?? 0),
      followingUserCount: followingCounts.followingUserCount,
      followingAuthorCount: followingCounts.followingAuthorCount,
      followingSectionCount: followingCounts.followingSectionCount,
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

  /**
   * 更新用户论坛主题数。
   */
  async updateForumTopicCount(
    tx: Db | undefined,
    userId: number,
    delta: number,
  ) {
    await this.updateCountField(tx, userId, 'forumTopicCount', delta)
  }

  /**
   * 更新用户评论收到的点赞数。
   */
  async updateCommentReceivedLikeCount(
    tx: Db | undefined,
    userId: number,
    delta: number,
  ) {
    await this.updateCountField(tx, userId, 'commentReceivedLikeCount', delta)
  }

  /**
   * 更新用户论坛主题收到的点赞数。
   */
  async updateForumTopicReceivedLikeCount(
    tx: Db | undefined,
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

  /**
   * 更新用户论坛主题收到的收藏数。
   */
  async updateForumTopicReceivedFavoriteCount(
    tx: Db | undefined,
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
