import { sql } from 'drizzle-orm'
import {
  check,
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
 * 任务分配记录。
 *
 * 每条记录表示某个用户在某个周期内命中的一次任务实例，是任务执行状态的事实来源。
 */
export const taskAssignment = pgTable('task_assignment', {
  /**
   * assignment 主键。
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 任务 ID。
   */
  taskId: integer().notNull(),
  /**
   * 任务归属用户 ID。
   */
  userId: integer().notNull(),
  /**
   * 周期标识。
   */
  cycleKey: varchar({ length: 32 }).notNull(),
  /**
   * 分配状态。0=已领取待开始，1=进行中，2=已完成，3=已过期。
   */
  status: smallint().notNull(),
  /**
   * 是否需要奖励结算。
   * true=该 assignment 需要补发奖励；false=无奖励任务，不生成结算事实。
   */
  rewardApplicable: smallint().default(0).notNull(),
  /**
   * 关联的奖励结算事实 ID。
   * 任务完成后统一挂接到 `growth_reward_settlement`，不再在 assignment 冗余保存奖励状态。
   */
  rewardSettlementId: integer(),
  /**
   * 当前进度。
   * 与 `target` 对比后决定是否满足完成条件。
   */
  progress: integer().default(0).notNull(),
  /**
   * 目标次数。
   * 来自任务配置快照，必须大于 0，避免模板变更影响历史实例判定。
   */
  target: integer().default(1).notNull(),
  /**
   * 任务快照。
   * 记录领取当下的关键配置，支持模板变更后仍按历史语义补偿奖励与展示文案。
   */
  taskSnapshot: jsonb(),
  /**
   * 任务上下文。
   * 保存领取来源、事件附加信息或推进过程中的额外业务上下文。
   */
  context: jsonb(),
  /**
   * 乐观锁版本号。
   * 用于并发推进时避免覆盖彼此的进度写入。
   */
  version: integer().default(0).notNull(),
  /**
   * 领取时间。
   */
  claimedAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 完成时间。
   */
  completedAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 过期时间。
   * 由发布窗口与重复周期共同裁剪得出，非空后会被定时任务自动关闭。
   */
  expiredAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * assignment 创建时间。
   * 主要用于审计和列表排序，不等同于 claimedAt。
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * assignment 最近更新时间。
   * 反映最后一次状态推进或奖励同步，不代表事件发生时间。
   */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
  /**
   * 软删除时间。
   * 仅用于逻辑移除异常记录，正常历史审计通常依赖状态字段而不是物理删除。
   */
  deletedAt: timestamp({ withTimezone: true, precision: 6 }),
}, (table) => [
  /**
   * 同用户、同任务、同周期唯一约束。
   */
  unique('task_assignment_task_id_user_id_cycle_key_key').on(table.taskId, table.userId, table.cycleKey),
  /**
   * 用户与状态索引
   */
  index('task_assignment_user_id_status_idx').on(table.userId, table.status),
  /**
   * 任务索引
   */
  index('task_assignment_task_id_idx').on(table.taskId),
  /**
   * 完成时间索引
   */
  index('task_assignment_completed_at_idx').on(table.completedAt),
  /**
   * 过期时间索引
   */
  index('task_assignment_expired_at_idx').on(table.expiredAt),
  /**
   * 奖励结算事实索引
   */
  index('task_assignment_reward_settlement_id_idx').on(table.rewardSettlementId),
  /**
   * 删除时间索引
   */
  index('task_assignment_deleted_at_idx').on(table.deletedAt),
  /**
   * 目标次数必须大于 0
   */
  check('task_assignment_target_positive_chk', sql`${table.target} > 0`),
  /**
   * 分配状态值域约束
   */
  check('task_assignment_status_valid_chk', sql`${table.status} in (0, 1, 2, 3)`),
  check('task_assignment_reward_applicable_valid_chk', sql`${table.rewardApplicable} in (0, 1)`),
  /**
   * 当前进度不能为负数
   */
  check('task_assignment_progress_non_negative_chk', sql`${table.progress} >= 0`),
  /**
   * 版本号不能为负数
   */
  check('task_assignment_version_non_negative_chk', sql`${table.version} >= 0`),
  check(
    'task_assignment_reward_settlement_id_positive_chk',
    sql`${table.rewardSettlementId} is null or ${table.rewardSettlementId} > 0`,
  ),
]);

export type TaskAssignment = typeof taskAssignment.$inferSelect
export type TaskAssignmentSelect = TaskAssignment
export type TaskAssignmentInsert = typeof taskAssignment.$inferInsert
