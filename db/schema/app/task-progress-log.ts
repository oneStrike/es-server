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
 * 任务进度日志。
 *
 * 记录 assignment 状态推进的事实轨迹，用于幂等校验、审计回溯和奖励排障。
 */
export const taskProgressLog = pgTable('task_progress_log', {
  /**
   * 进度日志主键。
   * 仅用于时间序对账和排障定位，不参与幂等约束。
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 分配记录 ID。
   * 指向被推进的 assignment，是日志与执行状态之间的事实关联键。
   */
  assignmentId: integer().notNull(),
  /**
   * 本次推进归属的用户 ID。
   * 主要用于审计、筛选和对账视图，不单独决定幂等。
   */
  userId: integer().notNull(),
  /**
   * 操作类型。 1=领取，2=上报进度，3=完成，4=过期。
   */
  actionType: smallint().notNull(),
  /**
   * 推进来源。 1=用户手动操作，2=事件驱动，3=系统补偿或自动推进。
   */
  progressSource: smallint().default(1).notNull(),
  /**
   * 变更值。
   * 对于领取或显式完成等动作可以为 0，表示仅状态发生变化。
   */
  delta: integer().notNull(),
  /**
   * 变更前值。
   */
  beforeValue: integer().notNull(),
  /**
   * 变更后值。
   */
  afterValue: integer().notNull(),
  /**
   * 关联事件编码。
   * 仅事件驱动推进时有值，用于对账与事件回溯。
   */
  eventCode: integer(),
  /**
   * 关联事件幂等键。
   * 与 assignment 组成唯一约束，保证同一事件不会重复推进同一实例。
   */
  eventBizKey: varchar({ length: 180 }),
  /**
   * 事件发生时间。
   * 用于按真实发生时刻落周期，而不是按消费者接收时间计算。
   */
  eventOccurredAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 变更上下文。
   * 保存额外业务上下文、事件摘要或补偿线索，便于排障。
   */
  context: jsonb(),
  /**
   * 日志写入时间。
   * 与 eventOccurredAt 区分开来，后者表示业务事件真实发生时刻。
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

export type TaskProgressLog = typeof taskProgressLog.$inferSelect
export type TaskProgressLogInsert = typeof taskProgressLog.$inferInsert
