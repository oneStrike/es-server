import type { Db } from '@db/core'
import { DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'
import { eq, sql } from 'drizzle-orm'

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
        forumTopicCount: this.appUserCount.forumTopicCount,
        forumReplyCount: this.appUserCount.forumReplyCount,
        forumReceivedLikeCount: this.appUserCount.forumReceivedLikeCount,
        forumReceivedFavoriteCount:
          this.appUserCount.forumReceivedFavoriteCount,
      })
      .from(this.appUserCount)
      .where(eq(this.appUserCount.userId, userId))
      .limit(1)
      .then((rows) => rows[0])

    return {
      userId,
      forumTopicCount: counts?.forumTopicCount ?? 0,
      forumReplyCount: counts?.forumReplyCount ?? 0,
      forumReceivedLikeCount: counts?.forumReceivedLikeCount ?? 0,
      forumReceivedFavoriteCount: counts?.forumReceivedFavoriteCount ?? 0,
    }
  }

  /**
   * 初始化用户计数
   */
  async initUserCounts(tx: Db | undefined, userId: number) {
    const client = tx ?? this.db
    await client.insert(this.appUserCount).values({
      userId,
      forumTopicCount: 0,
      forumReplyCount: 0,
      forumReceivedLikeCount: 0,
      forumReceivedFavoriteCount: 0,
    })
  }

  /**
   * 更新用户的论坛主题数
   */
  async updateForumTopicCount(
    tx: Db | undefined,
    userId: number,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }
    await this.executeCountUpdate(
      tx,
      (client) =>
        client
          .update(this.appUserCount)
          .set({
            forumTopicCount: sql`${this.appUserCount.forumTopicCount} + ${delta}`,
          })
          .where(eq(this.appUserCount.userId, userId)),
      '用户计数不存在',
    )
  }

  /**
   * 更新用户的论坛回复数
   */
  async updateForumReplyCount(
    tx: Db | undefined,
    userId: number,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }
    await this.executeCountUpdate(
      tx,
      (client) =>
        client
          .update(this.appUserCount)
          .set({
            forumReplyCount: sql`${this.appUserCount.forumReplyCount} + ${delta}`,
          })
          .where(eq(this.appUserCount.userId, userId)),
      '用户计数不存在',
    )
  }

  /**
   * 更新用户收到的论坛点赞数
   */
  async updateForumReceivedLikeCount(
    tx: Db | undefined,
    userId: number,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }
    await this.executeCountUpdate(
      tx,
      (client) =>
        client
          .update(this.appUserCount)
          .set({
            forumReceivedLikeCount:
              sql`${this.appUserCount.forumReceivedLikeCount} + ${delta}`,
          })
          .where(eq(this.appUserCount.userId, userId)),
      '用户计数不存在',
    )
  }

  /**
   * 更新用户收到的论坛收藏数
   */
  async updateForumReceivedFavoriteCount(
    tx: Db | undefined,
    userId: number,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }
    await this.executeCountUpdate(
      tx,
      (client) =>
        client
          .update(this.appUserCount)
          .set({
            forumReceivedFavoriteCount:
              sql`${this.appUserCount.forumReceivedFavoriteCount} + ${delta}`,
          })
          .where(eq(this.appUserCount.userId, userId)),
      '用户计数不存在',
    )
  }
}
