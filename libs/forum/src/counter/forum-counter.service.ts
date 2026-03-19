import type { Db } from '@db/core'
import { DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'
import { eq, sql } from 'drizzle-orm'

/**
 * 论坛计数服务类
 * 负责管理论坛相关的计数器，包括版块、主题和用户档案的各种计数
 * 提供统一的计数更新接口，确保计数数据的一致性
 */
@Injectable()
export class ForumCounterService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  get forumSection() {
    return this.drizzle.schema.forumSection
  }

  get forumTopic() {
    return this.drizzle.schema.forumTopic
  }

  get forumProfile() {
    return this.drizzle.schema.forumProfile
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
   * 更新用户档案的主题数量
   * @param tx - 事务对象，如果在事务中调用则传入，否则使用默认 数据库客户端
   * @param userId - 用户ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   * @returns 更新后的用户档案信息
   */
  async updateProfileTopicCount(tx: Db | undefined, userId: number, delta: number) {
    if (delta === 0) {
      return
    }
    await this.executeCountUpdate(
      tx,
      (client) =>
        client
          .update(this.forumProfile)
          .set({ topicCount: sql`${this.forumProfile.topicCount} + ${delta}` })
          .where(eq(this.forumProfile.userId, userId)),
      '用户画像不存在',
    )
  }

  /**
   * 更新用户档案的回复数量
   * @param tx - 事务对象，如果在事务中调用则传入，否则使用默认 数据库客户端
   * @param userId - 用户ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   * @returns 更新后的用户档案信息
   */
  async updateProfileReplyCount(tx: Db | undefined, userId: number, delta: number) {
    if (delta === 0) {
      return
    }
    await this.executeCountUpdate(
      tx,
      (client) =>
        client
          .update(this.forumProfile)
          .set({ replyCount: sql`${this.forumProfile.replyCount} + ${delta}` })
          .where(eq(this.forumProfile.userId, userId)),
      '用户画像不存在',
    )
  }

  /**
   * 更新用户档案的点赞数量
   * @param tx - 事务对象，如果在事务中调用则传入，否则使用默认 数据库客户端
   * @param userId - 用户ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   * @returns 更新后的用户档案信息
   */
  async updateProfileLikeCount(tx: Db | undefined, userId: number, delta: number) {
    if (delta === 0) {
      return
    }
    await this.executeCountUpdate(
      tx,
      (client) =>
        client
          .update(this.forumProfile)
          .set({ likeCount: sql`${this.forumProfile.likeCount} + ${delta}` })
          .where(eq(this.forumProfile.userId, userId)),
      '用户画像不存在',
    )
  }

  /**
   * 更新用户档案的收藏数量
   * @param tx - 事务对象，如果在事务中调用则传入，否则使用默认 数据库客户端
   * @param userId - 用户ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   * @returns 更新后的用户档案信息
   */
  async updateProfileFavoriteCount(
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
          .update(this.forumProfile)
          .set({ favoriteCount: sql`${this.forumProfile.favoriteCount} + ${delta}` })
          .where(eq(this.forumProfile.userId, userId)),
      '用户画像不存在',
    )
  }

  /**
   * 批量更新回复相关的所有计数
   * 包括主题回复数、版块回复数、用户档案回复数
   * @param tx - 事务对象
   * @param topicId - 主题ID
   * @param sectionId - 版块ID
   * @param userId - 用户ID
   * @param delta - 增量值，正数表示增加，负数表示减少
   */
  async updateReplyRelatedCounts(
    tx: Db | undefined,
    topicId: number,
    sectionId: number,
    userId: number,
    delta: number,
  ) {
    await Promise.all([
      this.updateTopicReplyCount(tx, topicId, delta),
      this.updateSectionReplyCount(tx, sectionId, delta),
      this.updateProfileReplyCount(tx, userId, delta),
    ])
  }

  /**
   * 批量更新主题相关的所有计数
   * 包括版块主题数、用户档案主题数
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
      this.updateProfileTopicCount(tx, userId, delta),
    ])
  }

  /**
   * 批量更新主题点赞相关的所有计数
   * 包括主题点赞数、主题作者的用户档案点赞数
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
      this.updateProfileLikeCount(tx, authorUserId, delta),
    ])
  }

  /**
   * 批量更新主题收藏相关的所有计数
   * 包括主题收藏数、主题作者的用户档案收藏数
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
      this.updateProfileFavoriteCount(tx, authorUserId, delta),
    ])
  }

  async getTopicInfo(topicId: number) {
    return this.db.query.forumTopic.findFirst({
      where: { id: topicId },
      columns: { id: true, userId: true, sectionId: true },
    })
  }
}
