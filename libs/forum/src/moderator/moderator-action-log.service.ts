import type { Db } from '@db/core'
import type { SQL } from 'drizzle-orm'
import type { ForumModeratorActionLogInput } from './moderator.type'
import { DrizzleService, toPageResult } from '@db/core'
import { buildDateOnlyRangeInAppTimeZone } from '@libs/platform/utils'
import { Injectable } from '@nestjs/common'
import { and, eq, gte, lt } from 'drizzle-orm'
import {
  QueryAdminForumModeratorActionLogDto,
  QueryAppForumModeratorActionLogDto,
} from './dto/moderator-action-log.dto'
import { ForumGovernanceActorTypeEnum } from './moderator-action-log.constant'

/**
 * 版主操作日志服务。
 * 统一承载 moderator 对 topic/comment 的治理动作落库，避免各治理入口重复拼日志结构。
 */
@Injectable()
export class ForumModeratorActionLogService {
  constructor(private readonly drizzle: DrizzleService) {}

  /** 统一复用当前模块的 Drizzle 数据库实例。 */
  private get db() {
    return this.drizzle.db
  }

  /** forum_moderator_action_log 表访问入口。 */
  private get forumModeratorActionLog() {
    return this.drizzle.schema.forumModeratorActionLog
  }

  /**
   * 将操作前后快照序列化为 JSON 字符串。
   * 仅在有值时落库，避免空字符串污染日志语义。
   */
  private serializeSnapshot(snapshot?: unknown) {
    if (snapshot === undefined) {
      return null
    }

    return JSON.stringify(snapshot)
  }

  private buildQueryWhere(
    query: QueryAdminForumModeratorActionLogDto & {
      moderatorId?: number | null
    },
  ) {
    const conditions: SQL[] = []
    const dateRange = buildDateOnlyRangeInAppTimeZone(
      query.startDate,
      query.endDate,
    )

    if (query.moderatorId != null) {
      conditions.push(
        eq(this.forumModeratorActionLog.moderatorId, query.moderatorId),
      )
    }
    if (query.actorType !== undefined) {
      conditions.push(eq(this.forumModeratorActionLog.actorType, query.actorType))
    }
    if (query.actorUserId !== undefined) {
      conditions.push(
        eq(this.forumModeratorActionLog.actorUserId, query.actorUserId),
      )
    }
    if (query.targetId !== undefined) {
      conditions.push(eq(this.forumModeratorActionLog.targetId, query.targetId))
    }
    if (query.targetType !== undefined) {
      conditions.push(
        eq(this.forumModeratorActionLog.targetType, query.targetType),
      )
    }
    if (query.actionType !== undefined) {
      conditions.push(
        eq(this.forumModeratorActionLog.actionType, query.actionType),
      )
    }
    if (dateRange?.gte) {
      conditions.push(
        gte(this.forumModeratorActionLog.createdAt, dateRange.gte),
      )
    }
    if (dateRange?.lt) {
      conditions.push(lt(this.forumModeratorActionLog.createdAt, dateRange.lt))
    }

    return conditions.length > 0 ? and(...conditions) : undefined
  }

  private async insertActionLog(db: Db, input: ForumModeratorActionLogInput) {
    const actorType =
      input.actorType === 'admin'
        ? ForumGovernanceActorTypeEnum.ADMIN
        : ForumGovernanceActorTypeEnum.MODERATOR
    await this.drizzle.withErrorHandling(() =>
      db.insert(this.forumModeratorActionLog).values({
        moderatorId: input.moderatorId,
        actorType,
        actorUserId: input.actorUserId,
        targetId: input.targetId,
        actionType: input.actionType,
        targetType: input.targetType,
        actionDescription: input.actionDescription,
        beforeData: this.serializeSnapshot(input.beforeData),
        afterData: this.serializeSnapshot(input.afterData),
      }),
    )

    return true
  }

  /**
   * 写入一条正式版主操作日志。
   * 当前 topic/comment moderator governance 统一通过本服务落日志。
   */
  async createActionLog(input: ForumModeratorActionLogInput) {
    return this.insertActionLog(this.db, input)
  }

  /**
   * 在现有事务中写入版主操作日志，保证治理写入和审计事实同生共死。
   */
  async createActionLogInTx(tx: Db, input: ForumModeratorActionLogInput) {
    return this.insertActionLog(tx, input)
  }

  /**
   * 查询当前版主自己的操作日志。
   * moderatorId 由服务端身份解析后强制传入，禁止信任客户端传入的 moderatorId。
   */
  async getAppActionLogPage(
    moderatorId: number,
    query: QueryAppForumModeratorActionLogDto,
  ) {
    const { orderBy: _clientOrderBy, ...pageDto } = query
    const where = this.buildQueryWhere({
      ...pageDto,
      moderatorId,
    })
    const pageQuery = this.drizzle.buildPage(pageDto)
    const orderQuery = this.drizzle.buildOrderBy({ createdAt: 'desc' }, {
      table: this.forumModeratorActionLog,
    })
    const [list, total] = await Promise.all([
      this.db
        .select({
          id: this.forumModeratorActionLog.id,
          moderatorId: this.forumModeratorActionLog.moderatorId,
          actorType: this.forumModeratorActionLog.actorType,
          actorUserId: this.forumModeratorActionLog.actorUserId,
          targetId: this.forumModeratorActionLog.targetId,
          actionType: this.forumModeratorActionLog.actionType,
          targetType: this.forumModeratorActionLog.targetType,
          actionDescription: this.forumModeratorActionLog.actionDescription,
          createdAt: this.forumModeratorActionLog.createdAt,
        })
        .from(this.forumModeratorActionLog)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(pageQuery.limit)
        .offset(pageQuery.offset),
      this.db.$count(this.forumModeratorActionLog, where),
    ])
    const page = toPageResult(list, total, pageQuery)

    return {
      ...page,
      list: page.list,
    }
  }

  /**
   * 管理端分页查询版主操作日志。
   * 保留 beforeData/afterData 快照，供具备后台权限的运维审计场景使用。
   */
  async getAdminActionLogPage(query: QueryAdminForumModeratorActionLogDto) {
    const { orderBy: _clientOrderBy, ...pageDto } = query

    const where = this.buildQueryWhere(pageDto)
    const page = this.drizzle.buildPage(pageDto)
    const orderQuery = this.drizzle.buildOrderBy({ createdAt: 'desc' }, {
      table: this.forumModeratorActionLog,
    })
    const [list, total] = await Promise.all([
      this.db
        .select()
        .from(this.forumModeratorActionLog)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.forumModeratorActionLog, where),
    ])
    const result = toPageResult(list, total, page)

    return {
      ...result,
      list: result.list.map((item) => ({
        ...item,
        beforeData: item.beforeData ?? null,
        afterData: item.afterData ?? null,
      })),
    }
  }
}
