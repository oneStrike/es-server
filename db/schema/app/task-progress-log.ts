import {
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 任务进度日志
 */
export const taskProgressLog = pgTable('task_progress_log', {
  /**
   * 主键id
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 分配记录ID
   */
  assignmentId: integer().notNull(),
  /**
   * 用户ID
   */
  userId: integer().notNull(),
  /**
   * 操作类型
   */
  actionType: smallint().notNull(),
  /**
   * 推进来源
   */
  progressSource: smallint().default(1).notNull(),
  /**
   * 变更值
   */
  delta: integer().notNull(),
  /**
   * 变更前值
   */
  beforeValue: integer().notNull(),
  /**
   * 变更后值
   */
  afterValue: integer().notNull(),
  /**
   * 关联事件编码
   */
  eventCode: integer(),
  /**
   * 关联事件幂等键
   */
  eventBizKey: varchar({ length: 180 }),
  /**
   * 事件发生时间
   */
  eventOccurredAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 变更上下文
   */
  context: jsonb(),
  /**
   * 创建时间
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => [
  /**
   * assignment + eventBizKey 唯一约束
   * 仅对非空 eventBizKey 生效，保证事件重放不会重复推进同一 assignment。
   */
  unique('task_progress_log_assignment_id_event_biz_key_key').on(
    table.assignmentId,
    table.eventBizKey,
  ),
  /**
   * 分配记录索引
   */
  index('task_progress_log_assignment_id_idx').on(table.assignmentId),
  /**
   * 用户与创建时间索引
   */
  index('task_progress_log_user_id_created_at_idx').on(
    table.userId,
    table.createdAt,
  ),
  /**
   * 事件编码与创建时间索引
   */
  index('task_progress_log_event_code_created_at_idx').on(
    table.eventCode,
    table.createdAt,
  ),
])
