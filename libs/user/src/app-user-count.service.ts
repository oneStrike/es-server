import type { Db } from '@db/core'
import { DrizzleService } from '@db/core'
import { applyCountDelta } from '@db/extensions'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'

type AppUserCountField =
  | 'commentCount'
  | 'likeCount'
  | 'favoriteCount'
  | 'followingUserCount'
  | 'followingAuthorCount'
  | 'followingSectionCount'
  | 'followersCount'
  | 'forumTopicCount'
  | 'commentReceivedLikeCount'
  | 'forumTopicReceivedLikeCount'
  | 'forumTopicReceivedFavoriteCount'

interface UserFollowingCounts {
  followingUserCount: number
  followingAuthorCount: number
  followingSectionCount: number
}

interface RebuiltAppUserCounts {
  userId: number
  commentCount: number
  likeCount: number
  favoriteCount: number
  followingUserCount: number
  followingAuthorCount: number
  followingSectionCount: number
  followersCount: number
  forumTopicCount: number
  commentReceivedLikeCount: number
  forumTopicReceivedLikeCount: number
  forumTopicReceivedFavoriteCount: number
}

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

  private get userFollow() {
    return this.drizzle.schema.userFollow
  }

  private get userLike() {
    return this.drizzle.schema.userLike
  }

  private get userFavorite() {
    return this.drizzle.schema.userFavorite
  }

  private get userComment() {
    return this.drizzle.schema.userComment
  }

  private get forumTopic() {
    return this.drizzle.schema.forumTopic
  }

  private resolveFollowingCountField(
    targetType: number,
  ): keyof UserFollowingCounts {
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

  private async getFollowingCounts(
    client: Db,
    userId: number,
  ): Promise<UserFollowingCounts> {
    const rows = await client
      .select({
        targetType: this.userFollow.targetType,
        count: sql<number>`count(*)::int`,
      })
      .from(this.userFollow)
      .where(eq(this.userFollow.userId, userId))
      .groupBy(this.userFollow.targetType)

    const counts: UserFollowingCounts = {
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
   * 获取用户计数
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
      forumTopicReceivedLikeCount:
        counts?.forumTopicReceivedLikeCount ?? 0,
      forumTopicReceivedFavoriteCount:
        counts?.forumTopicReceivedFavoriteCount ?? 0,
    }
  }

  /**
   * 初始化用户计数
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
   * 更新用户计数字段
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
   * 更新用户的评论数
   */
  async updateCommentCount(
    tx: Db | undefined,
    userId: number,
    delta: number,
  ) {
    await this.updateCountField(tx, userId, 'commentCount', delta)
  }

  /**
   * 更新用户的点赞数
   */
  async updateLikeCount(
    tx: Db | undefined,
    userId: number,
    delta: number,
  ) {
    await this.updateCountField(tx, userId, 'likeCount', delta)
  }

  /**
   * 更新用户的收藏数
   */
  async updateFavoriteCount(
    tx: Db | undefined,
    userId: number,
    delta: number,
  ) {
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
   * 更新用户粉丝数量
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
        .from(this.userFollow)
        .where(
          and(
            eq(this.userFollow.targetType, this.userFollowTargetType),
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

  /**
   * 根据事实表重建 app_user_count 的全部核心聚合字段。
   * 该方法以事实表为准，不依赖现有读模型值。
   */
  async rebuildUserCounts(
    tx: Db | undefined,
    userId: number,
  ): Promise<RebuiltAppUserCounts> {
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
        .from(this.userComment)
        .where(
          and(
            eq(this.userComment.userId, userId),
            isNull(this.userComment.deletedAt),
          ),
        )
        .then((rows) => rows[0]),
      client
        .select({ count: sql<number>`count(*)::int` })
        .from(this.userLike)
        .where(eq(this.userLike.userId, userId))
        .then((rows) => rows[0]),
      client
        .select({ count: sql<number>`count(*)::int` })
        .from(this.userFavorite)
        .where(eq(this.userFavorite.userId, userId))
        .then((rows) => rows[0]),
      this.getFollowingCounts(client, userId),
      client
        .select({ count: sql<number>`count(*)::int` })
        .from(this.userFollow)
        .where(
          and(
            eq(this.userFollow.targetType, this.userFollowTargetType),
            eq(this.userFollow.targetId, userId),
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
        .from(this.userLike)
        .innerJoin(
          this.userComment,
          and(
            eq(this.userComment.id, this.userLike.targetId),
            eq(this.userComment.userId, userId),
            isNull(this.userComment.deletedAt),
          ),
        )
        .where(eq(this.userLike.targetType, this.commentLikeTargetType))
        .then((rows) => rows[0]),
      client
        .select({ count: sql<number>`count(*)::int` })
        .from(this.userLike)
        .innerJoin(
          this.forumTopic,
          and(
            eq(this.forumTopic.id, this.userLike.targetId),
            eq(this.forumTopic.userId, userId),
            isNull(this.forumTopic.deletedAt),
          ),
        )
        .where(eq(this.userLike.targetType, this.forumTopicLikeTargetType))
        .then((rows) => rows[0]),
      client
        .select({ count: sql<number>`count(*)::int` })
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
          eq(
            this.userFavorite.targetType,
            this.forumTopicFavoriteTargetType,
          ),
        )
        .then((rows) => rows[0]),
    ])

    const rebuiltCounts: RebuiltAppUserCounts = {
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
   * 更新用户的论坛主题数
   */
  async updateForumTopicCount(
    tx: Db | undefined,
    userId: number,
    delta: number,
  ) {
    await this.updateCountField(tx, userId, 'forumTopicCount', delta)
  }

  /**
   * 更新用户评论收到的点赞数
   */
  async updateCommentReceivedLikeCount(
    tx: Db | undefined,
    userId: number,
    delta: number,
  ) {
    await this.updateCountField(tx, userId, 'commentReceivedLikeCount', delta)
  }

  /**
   * 更新用户论坛主题收到的点赞数
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
   * 更新用户论坛主题收到的收藏数
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
