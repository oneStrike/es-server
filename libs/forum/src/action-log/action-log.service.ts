import type { Db, SQL } from '@db/core'
import { DrizzleService } from '@db/core'
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
        .returning(),
    )

    return data[0]
  }

  /**
   * 创建用户操作日志
   * @param dto - 操作日志选项对象
   * @returns 创建的操作日志记录
   */
  async createActionLog(dto: CreateForumActionLogDto) {
    return this.insertActionLog(this.db, dto)
  }

  /**
   * 在现有事务中写入一条用户操作日志。
   * 供论坛交互链路在事务内复用，避免日志脱离主写入上下文。
   */
  async createActionLogInTx(tx: Db, dto: CreateForumActionLogDto) {
    return this.insertActionLog(tx, dto)
  }

  /**
   * 根据用户ID查询操作日志（分页）
   * @param dto - 查询选项对象
   * @returns 操作日志分页结果，包含列表、总数、页码和每页数量
   */
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

    return this.drizzle.ext.findPagination(this.forumUserActionLog, {
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: { createdAt: 'desc' },
      ...pageDto,
    })
  }
}
