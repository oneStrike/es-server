import type { Db, DbExecutor, SQL } from '@db/core'
import { DrizzleService, toPageResult } from '@db/core'
import { Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import {
  CreateForumActionLogDto,
  QueryForumActionLogDto,
} from './dto/action-log.dto'

/**
 * 论坛用户操作日志服务类
 * 提供用户操作日志的记录、查询等核心业务逻辑
 */
@Injectable()
export class ForumUserActionLogService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  get forumUserActionLog() {
    return this.drizzle.schema.forumUserActionLog
  }

  // 将日志前后快照统一序列化为 JSON 字符串，避免各调用方重复处理。
  private serializeSnapshot(snapshot?: unknown) {
    if (snapshot === undefined) {
      return null
    }

    return typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot)
  }

  // 向指定数据库上下文写入一条正式用户操作日志。
  private async insertActionLog(db: Db, dto: CreateForumActionLogDto) {
    const {
      userId,
      actionType,
      targetType,
      targetId,
      beforeData,
      afterData,
      ipAddress,
      userAgent,
      geoCountry,
      geoProvince,
      geoCity,
      geoIsp,
      geoSource,
    } = dto

    const data = await this.drizzle.withErrorHandling(() =>
      db
        .insert(this.forumUserActionLog)
        .values({
          userId,
          actionType,
          targetType,
          targetId,
          beforeData: this.serializeSnapshot(beforeData),
          afterData: this.serializeSnapshot(afterData),
          ipAddress,
          userAgent,
          geoCountry,
          geoProvince,
          geoCity,
          geoIsp,
          geoSource,
        })
        .returning({ id: this.forumUserActionLog.id }),
    )

    return data[0]
  }

  // 创建用户操作日志
  async createActionLog(dto: CreateForumActionLogDto) {
    return this.insertActionLog(this.db, dto)
  }

  // 在现有事务中写入一条用户操作日志。 供论坛交互链路在事务内复用，避免日志脱离主写入上下文。
  async createActionLogInTx(tx: DbExecutor, dto: CreateForumActionLogDto) {
    return this.insertActionLog(tx, dto)
  }

  // 根据用户ID查询操作日志（分页）
  async getActionLogsByUserId(dto: QueryForumActionLogDto) {
    const { userId, actionType, targetType, targetId, ...pageDto } = dto
    const conditions: SQL[] = []

    if (userId !== undefined) {
      conditions.push(eq(this.forumUserActionLog.userId, userId))
    }
    if (actionType !== undefined) {
      conditions.push(eq(this.forumUserActionLog.actionType, actionType))
    }
    if (targetType !== undefined) {
      conditions.push(eq(this.forumUserActionLog.targetType, targetType))
    }
    if (targetId !== undefined) {
      conditions.push(eq(this.forumUserActionLog.targetId, targetId))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const page = this.drizzle.buildPage(pageDto)
    const orderQuery = this.drizzle.buildOrderBy(
      { createdAt: 'desc' as const },
      { table: this.forumUserActionLog },
    )
    const [list, total] = await Promise.all([
      this.db
        .select({
          id: this.forumUserActionLog.id,
          userId: this.forumUserActionLog.userId,
          actionType: this.forumUserActionLog.actionType,
          targetType: this.forumUserActionLog.targetType,
          targetId: this.forumUserActionLog.targetId,
          beforeData: this.forumUserActionLog.beforeData,
          afterData: this.forumUserActionLog.afterData,
          ipAddress: this.forumUserActionLog.ipAddress,
          userAgent: this.forumUserActionLog.userAgent,
          geoCountry: this.forumUserActionLog.geoCountry,
          geoProvince: this.forumUserActionLog.geoProvince,
          geoCity: this.forumUserActionLog.geoCity,
          geoIsp: this.forumUserActionLog.geoIsp,
          geoSource: this.forumUserActionLog.geoSource,
          createdAt: this.forumUserActionLog.createdAt,
        })
        .from(this.forumUserActionLog)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.forumUserActionLog, where),
    ])

    return toPageResult(list, total, page)
  }
}
