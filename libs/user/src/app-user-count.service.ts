import type { Db } from '@db/core'
import { DrizzleService } from '@db/core'
import { applyCountDelta } from '@db/extensions'
import { Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'

type AppUserCountField =
  | 'commentCount'
  | 'likeCount'
  | 'favoriteCount'
  | 'followingCount'
  | 'followersCount'
  | 'forumTopicCount'
  | 'commentReceivedLikeCount'
  | 'forumTopicReceivedLikeCount'
  | 'forumTopicReceivedFavoriteCount'

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
        followingCount: this.appUserCount.followingCount,
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
      followingCount: counts?.followingCount ?? 0,
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
      followingCount: 0,
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
   * 更新用户发起关注数量
   */
  async updateFollowingCount(
    tx: Db | undefined,
    userId: number,
    delta: number,
  ) {
    await this.updateCountField(tx, userId, 'followingCount', delta)
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
   * 仅回填 followingCount / followersCount，不改动其他计数字段。
   */
  async rebuildFollowCounts(tx: Db | undefined, userId: number) {
    const client = tx ?? this.db
    const [followingRow, followersRow] = await Promise.all([
      client
        .select({ count: sql<number>`count(*)::int` })
        .from(this.userFollow)
        .where(eq(this.userFollow.userId, userId))
        .then((rows) => rows[0]),
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

    const followingCount = Number(followingRow?.count ?? 0)
    const followersCount = Number(followersRow?.count ?? 0)
    const persist = (executor: Db) =>
      executor
        .insert(this.appUserCount)
        .values({
          userId,
          followingCount,
          followersCount,
        })
        .onConflictDoUpdate({
          target: this.appUserCount.userId,
          set: {
            followingCount,
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
      followingCount,
      followersCount,
    }
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
