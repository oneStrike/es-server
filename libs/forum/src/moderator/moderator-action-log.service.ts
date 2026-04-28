import type { ForumModeratorActionLogInput } from './moderator.type'
import { DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'

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

  /**
   * 写入一条正式版主操作日志。
   * 当前 topic/comment moderator governance 统一通过本服务落日志。
   */
  async createActionLog(input: ForumModeratorActionLogInput) {
    await this.drizzle.withErrorHandling(() =>
      this.db.insert(this.forumModeratorActionLog).values({
        moderatorId: input.moderatorId,
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
}
