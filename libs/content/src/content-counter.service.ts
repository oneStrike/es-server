import type { Db } from '@db/core'
import type { InteractionTx } from '@libs/interaction'
import { DrizzleService } from '@db/core'
import { AppUserCountService } from '@libs/user'
import { Injectable } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'

/**
 * 内容领域计数服务
 * 负责管理内容相关实体计数，并委托全局用户计数服务维护用户计数字段
 */
@Injectable()
export class ContentCounterService {
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

  private async executeCountUpdate(
    tx: InteractionTx | undefined,
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
    tx: InteractionTx | undefined,
    sectionId: number,
    delta: number,
  ) {
    await this.executeCountUpdate(
      tx,
      (client) =>
        client
          .update(this.forumSection)
          .set({ topicCount: sql`${this.forumSection.topicCount} + ${delta}` })
          .where(
            and(eq(this.forumSection.id, sectionId), isNull(this.forumSection.deletedAt)),
          ),
      '版块不存在',
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
    tx: InteractionTx | undefined,
    sectionId: number,
    delta: number,
  ) {
    await this.executeCountUpdate(
      tx,
      (client) =>
        client
          .update(this.forumSection)
          .set({ replyCount: sql`${this.forumSection.replyCount} + ${delta}` })
          .where(
            and(eq(this.forumSection.id, sectionId), isNull(this.forumSection.deletedAt)),
          ),
      '版块不存在',
    )
  }

  /**
   * 更新主题的回复数量
   * @param tx - 事务对象，如果在事务中调用则传入，否则使用默认 数据库客户端
   * @param topicId - 主题ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   * @returns 更新后的主题信息
   */
  async updateTopicReplyCount(
    tx: InteractionTx | undefined,
    topicId: number,
    delta: number,
  ) {
    await this.executeCountUpdate(
      tx,
      (client) =>
        client
          .update(this.forumTopic)
          .set({ replyCount: sql`${this.forumTopic.replyCount} + ${delta}` })
          .where(
            and(eq(this.forumTopic.id, topicId), isNull(this.forumTopic.deletedAt)),
          ),
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
  async updateTopicLikeCount(
    tx: InteractionTx | undefined,
    topicId: number,
    delta: number,
  ) {
    await this.executeCountUpdate(
      tx,
      (client) =>
        client
          .update(this.forumTopic)
          .set({ likeCount: sql`${this.forumTopic.likeCount} + ${delta}` })
          .where(
            and(eq(this.forumTopic.id, topicId), isNull(this.forumTopic.deletedAt)),
          ),
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
    tx: InteractionTx | undefined,
    topicId: number,
    delta: number,
  ) {
    await this.executeCountUpdate(
      tx,
      (client) =>
        client
          .update(this.forumTopic)
          .set({ favoriteCount: sql`${this.forumTopic.favoriteCount} + ${delta}` })
          .where(
            and(eq(this.forumTopic.id, topicId), isNull(this.forumTopic.deletedAt)),
          ),
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
    tx: InteractionTx | undefined,
    userId: number,
    delta: number,
  ) {
    await this.appUserCountService.updateForumTopicCount(tx, userId, delta)
  }

  /**
   * 更新用户的论坛回复数量
   * @param tx - 事务对象，如果在事务中调用则传入，否则使用默认 数据库客户端
   * @param userId - 用户ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   * @returns 更新后的用户计数信息
   */
  async updateUserForumReplyCount(
    tx: InteractionTx | undefined,
    userId: number,
    delta: number,
  ) {
    await this.appUserCountService.updateForumReplyCount(tx, userId, delta)
  }

  /**
   * 更新用户收到的论坛点赞数量
   * @param tx - 事务对象，如果在事务中调用则传入，否则使用默认 数据库客户端
   * @param userId - 用户ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   * @returns 更新后的用户计数信息
   */
  async updateUserForumReceivedLikeCount(
    tx: InteractionTx | undefined,
    userId: number,
    delta: number,
  ) {
    await this.appUserCountService.updateForumReceivedLikeCount(
      tx,
      userId,
      delta,
    )
  }

  /**
   * 更新用户收到的论坛收藏数量
   * @param tx - 事务对象，如果在事务中调用则传入，否则使用默认 数据库客户端
   * @param userId - 用户ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   * @returns 更新后的用户计数信息
   */
  async updateUserForumReceivedFavoriteCount(
    tx: InteractionTx | undefined,
    userId: number,
    delta: number,
  ) {
    await this.appUserCountService.updateForumReceivedFavoriteCount(
      tx,
      userId,
      delta,
    )
  }

  /**
   * 批量更新回复相关的所有计数
   * 包括主题回复数、版块回复数、用户论坛回复数
   * @param tx - 事务对象
   * @param topicId - 主题ID
   * @param sectionId - 版块ID
   * @param userId - 用户ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   */
  async updateReplyRelatedCounts(
    tx: InteractionTx | undefined,
    topicId: number,
    sectionId: number,
    userId: number,
    delta: number,
  ) {
    await Promise.all([
      this.updateTopicReplyCount(tx, topicId, delta),
      this.updateSectionReplyCount(tx, sectionId, delta),
      this.updateUserForumReplyCount(tx, userId, delta),
    ])
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
    tx: InteractionTx | undefined,
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
    tx: InteractionTx | undefined,
    topicId: number,
    authorUserId: number,
    delta: number,
  ) {
    await Promise.all([
      this.updateTopicLikeCount(tx, topicId, delta),
      this.updateUserForumReceivedLikeCount(tx, authorUserId, delta),
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
    tx: InteractionTx | undefined,
    topicId: number,
    authorUserId: number,
    delta: number,
  ) {
    await Promise.all([
      this.updateTopicFavoriteCount(tx, topicId, delta),
      this.updateUserForumReceivedFavoriteCount(tx, authorUserId, delta),
    ])
  }

  async getTopicInfo(topicId: number) {
    return this.db.query.forumTopic.findFirst({
      where: { id: topicId, deletedAt: { isNull: true } },
      columns: { id: true, userId: true, sectionId: true },
    })
  }
}
