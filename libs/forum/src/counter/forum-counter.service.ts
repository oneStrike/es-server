import type { Db } from '@db/core'
import { DrizzleService } from '@db/core'
import { applyCountDelta } from '@db/extensions'
import { AuditStatusEnum } from '@libs/platform/constant'
import { AppUserCountService } from '@libs/user'
import { Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'

type ForumSectionCountField =
  | 'topicCount'
  | 'replyCount'
  | 'followersCount'

type ForumTopicCountField =
  | 'viewCount'
  | 'likeCount'
  | 'favoriteCount'

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
  private readonly forumTopicLikeTargetType = 3
  private readonly forumTopicFavoriteTargetType = 3
  private readonly forumTopicBrowseTargetType = 5
  private readonly forumTopicCommentTargetType = 5

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

  private get userLike() {
    return this.drizzle.schema.userLike
  }

  private get userFavorite() {
    return this.drizzle.schema.userFavorite
  }

  private get userBrowseLog() {
    return this.drizzle.schema.userBrowseLog
  }

  private get userComment() {
    return this.drizzle.schema.userComment
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

  private rethrowNotFound(error: unknown, message: string): never {
    if (
      error instanceof NotFoundException
      && !error.message.includes('计数不足')
    ) {
      throw new NotFoundException(message)
    }
    throw error
  }

  private async updateSectionCountField(
    tx: Db | undefined,
    sectionId: number,
    field: ForumSectionCountField,
    delta: number,
    message: string,
  ) {
    if (delta === 0) {
      return
    }

    const execute = async (client: Db) =>
      applyCountDelta(
        client,
        this.forumSection,
        and(
          eq(this.forumSection.id, sectionId),
          isNull(this.forumSection.deletedAt),
        )!,
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
      this.rethrowNotFound(error, message)
    }
  }

  private async updateTopicCountField(
    tx: Db | undefined,
    topicId: number,
    field: ForumTopicCountField,
    delta: number,
    message: string,
  ) {
    if (delta === 0) {
      return
    }

    const execute = async (client: Db) =>
      applyCountDelta(
        client,
        this.forumTopic,
        and(
          eq(this.forumTopic.id, topicId),
          isNull(this.forumTopic.deletedAt),
        )!,
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
      this.rethrowNotFound(error, message)
    }
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
    await this.updateSectionCountField(
      tx,
      sectionId,
      'topicCount',
      delta,
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
    await this.updateSectionCountField(
      tx,
      sectionId,
      'replyCount',
      delta,
      '板块不存在',
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
    await this.updateTopicCountField(
      tx,
      topicId,
      'likeCount',
      delta,
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
    await this.updateTopicCountField(
      tx,
      topicId,
      'favoriteCount',
      delta,
      '主题不存在',
    )
  }

  /**
   * 更新主题浏览数量
   */
  async updateTopicViewCount(
    tx: Db | undefined,
    topicId: number,
    delta: number,
  ) {
    await this.updateTopicCountField(
      tx,
      topicId,
      'viewCount',
      delta,
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
    await this.updateSectionCountField(
      tx,
      sectionId,
      'followersCount',
      delta,
      '板块不存在',
    )
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
   * 根据点赞/收藏/浏览事实表重建主题对象计数。
   * replyCount / commentCount 由 syncTopicReplyState 负责重算。
   */
  async rebuildTopicInteractionCounts(
    tx: Db | undefined,
    topicId: number,
  ) {
    const client = tx ?? this.db
    const [likeCount, favoriteCount, viewCount] = await Promise.all([
      client.$count(
        this.userLike,
        and(
          eq(this.userLike.targetType, this.forumTopicLikeTargetType),
          eq(this.userLike.targetId, topicId),
        ),
      ),
      client.$count(
        this.userFavorite,
        and(
          eq(this.userFavorite.targetType, this.forumTopicFavoriteTargetType),
          eq(this.userFavorite.targetId, topicId),
        ),
      ),
      client.$count(
        this.userBrowseLog,
        and(
          eq(this.userBrowseLog.targetType, this.forumTopicBrowseTargetType),
          eq(this.userBrowseLog.targetId, topicId),
        ),
      ),
    ])

    const persist = async (executor: Db) =>
      executor
        .update(this.forumTopic)
        .set({
          likeCount,
          favoriteCount,
          viewCount,
        })
        .where(
          and(
            eq(this.forumTopic.id, topicId),
            isNull(this.forumTopic.deletedAt),
          ),
        )

    const result = tx
      ? await persist(tx)
      : await this.drizzle.withErrorHandling(async () => persist(this.db))
    this.drizzle.assertAffectedRows(result, '主题不存在')

    return {
      topicId,
      likeCount,
      favoriteCount,
      viewCount,
    }
  }

  /**
   * 按可见回复事实表重建主题 replyCount/commentCount 与最后回复信息。
   */
  async syncTopicReplyState(tx: Db | undefined, topicId: number) {
    const client = tx ?? this.db
    const visibleReplyWhere = and(
      eq(this.userComment.targetType, this.forumTopicCommentTargetType),
      eq(this.userComment.targetId, topicId),
      eq(this.userComment.auditStatus, AuditStatusEnum.APPROVED),
      eq(this.userComment.isHidden, false),
      isNull(this.userComment.deletedAt),
    )

    const [replySummaryRows, latestReplyRows] = await Promise.all([
      client
        .select({
          replyCount: sql<number>`count(*)::int`,
        })
        .from(this.userComment)
        .where(visibleReplyWhere),
      client
        .select({
          userId: this.userComment.userId,
          createdAt: this.userComment.createdAt,
        })
        .from(this.userComment)
        .where(visibleReplyWhere)
        .orderBy(desc(this.userComment.createdAt), desc(this.userComment.id))
        .limit(1),
    ])

    const replyCount = replySummaryRows[0]?.replyCount ?? 0
    const latestReply = latestReplyRows[0]

    await this.executeCountUpdate(
      tx,
      (executor) =>
        executor
          .update(this.forumTopic)
          .set({
            replyCount,
            commentCount: replyCount,
            lastReplyAt: latestReply?.createdAt ?? null,
            lastReplyUserId: latestReply?.userId ?? null,
          })
          .where(
            and(
              eq(this.forumTopic.id, topicId),
              isNull(this.forumTopic.deletedAt),
            ),
          ),
      '主题不存在',
    )
  }

  /**
   * 按可见主题事实表重建板块 topicCount/replyCount/lastTopicId/lastPostAt。
   */
  async syncSectionVisibleState(tx: Db | undefined, sectionId: number) {
    const client = tx ?? this.db
    const visibleTopicWhere = and(
      eq(this.forumTopic.sectionId, sectionId),
      eq(this.forumTopic.auditStatus, AuditStatusEnum.APPROVED),
      eq(this.forumTopic.isHidden, false),
      isNull(this.forumTopic.deletedAt),
    )

    const activityAtSql = sql<Date | null>`coalesce(${this.forumTopic.lastReplyAt}, ${this.forumTopic.createdAt})`

    const [summaryRows, latestTopicRows] = await Promise.all([
      client
        .select({
          topicCount: sql<number>`count(*)::int`,
          replyCount: sql<number>`coalesce(sum(${this.forumTopic.replyCount}), 0)::int`,
        })
        .from(this.forumTopic)
        .where(visibleTopicWhere),
      client
        .select({
          id: this.forumTopic.id,
          lastPostAt: activityAtSql,
        })
        .from(this.forumTopic)
        .where(visibleTopicWhere)
        .orderBy(desc(activityAtSql), desc(this.forumTopic.id))
        .limit(1),
    ])

    const summary = summaryRows[0]
    const latestTopic = latestTopicRows[0]

    await this.executeCountUpdate(
      tx,
      (executor) =>
        executor
          .update(this.forumSection)
          .set({
            topicCount: summary?.topicCount ?? 0,
            replyCount: summary?.replyCount ?? 0,
            lastTopicId: latestTopic?.id ?? null,
            lastPostAt: latestTopic?.lastPostAt ?? null,
          })
          .where(
            and(
              eq(this.forumSection.id, sectionId),
              isNull(this.forumSection.deletedAt),
            ),
          ),
      '板块不存在',
    )
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
