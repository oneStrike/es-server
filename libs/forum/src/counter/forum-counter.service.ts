import type { Db } from '@db/core'
import { DrizzleService } from '@db/core'
import { applyCountDelta } from '@db/extensions'
import { AppUserCountService } from '@libs/user'
import { Injectable } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'

/**
 * 论坛领域计数服务
 * 负责管理论坛实体计数，并委托全局用户计数服务更新用户计数字段
 */
@Injectable()
export class ForumCounterService {
  /**
   * 关注板块目标类型值。
   * 与 follow 模块解耦，避免论坛域反向依赖 interaction follow 常量。
   */
  private readonly forumSectionFollowTargetType = 3

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly appUserCountService: AppUserCountService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  get forumSection() {
    return this.drizzle.schema.forumSection
  }

  get forumTopic() {
    return this.drizzle.schema.forumTopic
  }

  private get userFollow() {
    return this.drizzle.schema.userFollow
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
   * 更新版块的主题数量
   * @param tx - 事务对象，如果在事务中调用则传入，否则使用默认 数据库客户端
   * @param sectionId - 版块ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   * @returns 更新后的版块信息
   */
  async updateSectionTopicCount(
    tx: Db | undefined,
    sectionId: number,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }
    await this.executeCountUpdate(
      tx,
      (client) =>
        client
          .update(this.forumSection)
          .set({ topicCount: sql`${this.forumSection.topicCount} + ${delta}` })
          .where(eq(this.forumSection.id, sectionId)),
      '板块不存在',
    )
  }

  /**
   * 更新版块的回复数量
   * @param tx - 事务对象，如果在事务中调用则传入，否则使用默认 数据库客户端
   * @param sectionId - 版块ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   * @returns 更新后的版块信息
   */
  async updateSectionReplyCount(
    tx: Db | undefined,
    sectionId: number,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }
    await this.executeCountUpdate(
      tx,
      (client) =>
        client
          .update(this.forumSection)
          .set({ replyCount: sql`${this.forumSection.replyCount} + ${delta}` })
          .where(eq(this.forumSection.id, sectionId)),
      '板块不存在',
    )
  }

  /**
   * 更新主题的回复数量
   * @param tx - 事务对象，如果在事务中调用则传入，否则使用默认 数据库客户端
   * @param topicId - 主题ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   * @returns 更新后的主题信息
   */
  async updateTopicReplyCount(tx: Db | undefined, topicId: number, delta: number) {
    if (delta === 0) {
      return
    }
    await this.executeCountUpdate(
      tx,
      (client) =>
        client
          .update(this.forumTopic)
          .set({ replyCount: sql`${this.forumTopic.replyCount} + ${delta}` })
          .where(eq(this.forumTopic.id, topicId)),
      '主题不存在',
    )
  }

  /**
   * 更新主题的点赞数量
   * @param tx - 事务对象，如果在事务中调用则传入，否则使用默认 数据库客户端
   * @param topicId - 主题ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   * @returns 更新后的主题信息
   */
  async updateTopicLikeCount(tx: Db | undefined, topicId: number, delta: number) {
    if (delta === 0) {
      return
    }
    await this.executeCountUpdate(
      tx,
      (client) =>
        client
          .update(this.forumTopic)
          .set({ likeCount: sql`${this.forumTopic.likeCount} + ${delta}` })
          .where(eq(this.forumTopic.id, topicId)),
      '主题不存在',
    )
  }

  /**
   * 更新主题的收藏数量
   * @param tx - 事务对象，如果在事务中调用则传入，否则使用默认 数据库客户端
   * @param topicId - 主题ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   * @returns 更新后的主题信息
   */
  async updateTopicFavoriteCount(
    tx: Db | undefined,
    topicId: number,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }
    await this.executeCountUpdate(
      tx,
      (client) =>
        client
          .update(this.forumTopic)
          .set({ favoriteCount: sql`${this.forumTopic.favoriteCount} + ${delta}` })
          .where(eq(this.forumTopic.id, topicId)),
      '主题不存在',
    )
  }

  /**
   * 更新用户的论坛主题数量
   * @param tx - 事务对象，如果在事务中调用则传入，否则使用默认 数据库客户端
   * @param userId - 用户ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   * @returns 更新后的用户计数信息
   */
  async updateUserForumTopicCount(
    tx: Db | undefined,
    userId: number,
    delta: number,
  ) {
    await this.appUserCountService.updateForumTopicCount(tx, userId, delta)
  }

  /**
   * 更新用户收到的论坛主题点赞数量
   * @param tx - 事务对象，如果在事务中调用则传入，否则使用默认 数据库客户端
   * @param userId - 用户ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   * @returns 更新后的用户计数信息
   */
  async updateUserForumTopicReceivedLikeCount(
    tx: Db | undefined,
    userId: number,
    delta: number,
  ) {
    await this.appUserCountService.updateForumTopicReceivedLikeCount(
      tx,
      userId,
      delta,
    )
  }

  /**
   * 更新板块关注人数
   */
  async updateSectionFollowersCount(
    tx: Db | undefined,
    sectionId: number,
    delta: number,
  ) {
    if (delta === 0) {
      return
    }

    const execute = async (client: Db) =>
      applyCountDelta(
        client,
        this.forumSection,
        eq(this.forumSection.id, sectionId),
        'followersCount',
        delta,
      )

    if (tx) {
      await execute(tx)
      return
    }

    await this.drizzle.withErrorHandling(async () => execute(this.db))
  }

  /**
   * 根据 follow 事实表重建板块关注人数。
   */
  async rebuildSectionFollowersCount(
    tx: Db | undefined,
    sectionId: number,
  ) {
    const client = tx ?? this.db
    const row = await client
      .select({ count: sql<number>`count(*)::int` })
      .from(this.userFollow)
      .where(
        and(
          eq(this.userFollow.targetType, this.forumSectionFollowTargetType),
          eq(this.userFollow.targetId, sectionId),
        ),
      )
      .then((rows) => rows[0])

    const followersCount = Number(row?.count ?? 0)
    await this.executeCountUpdate(
      tx,
      (executor) =>
        executor
          .update(this.forumSection)
          .set({ followersCount })
          .where(eq(this.forumSection.id, sectionId)),
      '板块不存在',
    )

    return {
      sectionId,
      followersCount,
    }
  }

  /**
   * 更新用户收到的论坛主题收藏数量
   * @param tx - 事务对象，如果在事务中调用则传入，否则使用默认 数据库客户端
   * @param userId - 用户ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   * @returns 更新后的用户计数信息
   */
  async updateUserForumTopicReceivedFavoriteCount(
    tx: Db | undefined,
    userId: number,
    delta: number,
  ) {
    await this.appUserCountService.updateForumTopicReceivedFavoriteCount(
      tx,
      userId,
      delta,
    )
  }

  /**
   * 批量更新主题相关的所有计数
   * 包括版块主题数、用户论坛主题数
   * @param tx - 事务对象
   * @param sectionId - 版块ID
   * @param userId - 用户ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   */
  async updateTopicRelatedCounts(
    tx: Db | undefined,
    sectionId: number,
    userId: number,
    delta: number,
  ) {
    await Promise.all([
      this.updateSectionTopicCount(tx, sectionId, delta),
      this.updateUserForumTopicCount(tx, userId, delta),
    ])
  }

  /**
   * 批量更新主题点赞相关的所有计数
   * 包括主题点赞数、主题作者收到的论坛点赞数
   * @param tx - 事务对象
   * @param topicId - 主题ID
   * @param authorUserId - 主题作者的用户ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   */
  async updateTopicLikeRelatedCounts(
    tx: Db | undefined,
    topicId: number,
    authorUserId: number,
    delta: number,
  ) {
    await Promise.all([
      this.updateTopicLikeCount(tx, topicId, delta),
      this.updateUserForumTopicReceivedLikeCount(tx, authorUserId, delta),
    ])
  }

  /**
   * 批量更新主题收藏相关的所有计数
   * 包括主题收藏数、主题作者收到的论坛收藏数
   * @param tx - 事务对象
   * @param topicId - 主题ID
   * @param authorUserId - 主题作者的用户ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   */
  async updateTopicFavoriteRelatedCounts(
    tx: Db | undefined,
    topicId: number,
    authorUserId: number,
    delta: number,
  ) {
    await Promise.all([
      this.updateTopicFavoriteCount(tx, topicId, delta),
      this.updateUserForumTopicReceivedFavoriteCount(
        tx,
        authorUserId,
        delta,
      ),
    ])
  }

  async getTopicInfo(topicId: number) {
    return this.db.query.forumTopic.findFirst({
      where: { id: topicId },
      columns: { id: true, userId: true, sectionId: true },
    })
  }
}
