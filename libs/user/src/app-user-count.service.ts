import type { Db } from '@db/core'
import type { SQL } from 'drizzle-orm'
import { DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'
import { and, eq, gte, sql } from 'drizzle-orm'

type AppUserCountField =
  | 'commentCount'
  | 'likeCount'
  | 'favoriteCount'
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
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get appUserCount() {
    return this.drizzle.schema.appUserCount
  }

  private async executeCountUpdate(
    tx: Db | undefined,
    operation: (client: Db) => Promise<{ rowCount?: number | null } | unknown[]>,
    message: string,
  ) {
    const client = tx ?? this.db
    const result = tx
      ? await operation(client)
      : await this.drizzle.withErrorHandling(async () => operation(client))
    this.drizzle.assertAffectedRows(result, message)
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
    const column = this.appUserCount[field]
    const amount = Math.abs(delta)
    const setValue: Partial<Record<AppUserCountField, SQL>> = {
      [field]: delta > 0 ? sql`${column} + ${delta}` : sql`${column} - ${amount}`,
    }

    await this.executeCountUpdate(
      tx,
      (client) =>
        delta > 0
          ? client
              .update(this.appUserCount)
              .set(setValue)
              .where(eq(this.appUserCount.userId, userId))
          : client
              .update(this.appUserCount)
              .set(setValue)
              .where(
                and(
                  eq(this.appUserCount.userId, userId),
                  gte(column, amount),
                ),
              ),
      message,
    )
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
