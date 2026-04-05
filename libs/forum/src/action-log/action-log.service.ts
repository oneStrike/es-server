import type { SQL } from 'drizzle-orm'
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

  /**
   * 创建用户操作日志
   * @param dto - 操作日志选项对象
   * @returns 创建的操作日志记录
   */
  async createActionLog(dto: CreateForumActionLogDto) {
    const {
      userId,
      actionType,
      targetType,
      targetId,
      beforeData,
      afterData,
      ipAddress,
      userAgent,
    } = dto

    const data = await this.drizzle.withErrorHandling(() =>
      this.db
        .insert(this.forumUserActionLog)
        .values({
          userId,
          actionType,
          targetType,
          targetId,
          beforeData: beforeData
            ? typeof beforeData === 'string'
              ? beforeData
              : JSON.stringify(beforeData)
            : null,
          afterData: afterData
            ? typeof afterData === 'string'
              ? afterData
              : JSON.stringify(afterData)
            : null,
          ipAddress,
          userAgent,
        })
        .returning(),
    )
    return data[0]
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
      ...pageDto,
    })
  }
}
