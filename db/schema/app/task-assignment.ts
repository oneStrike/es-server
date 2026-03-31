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
   * 主键id
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 任务 ID。
   * 关联任务模板；即使模板后续被下线，assignment 仍保留快照与执行痕迹。
   */
  taskId: integer().notNull(),
  /**
   * 用户 ID。
   */
  userId: integer().notNull(),
  /**
   * 周期标识。
   * 用于约束同一用户在同一周期内只拥有一条 assignment。
   */
  cycleKey: varchar({ length: 32 }).notNull(),
  /**
   * 分配状态。
   * 表示领取、推进、完成和过期等执行阶段。
   */
  status: smallint().notNull(),
  /**
   * 奖励结算状态。
   * 仅描述任务 bonus 的到账结果，不覆盖其他成长事件奖励。
   */
  rewardStatus: smallint().default(0).notNull(),
  /**
   * 奖励结算结果类型。
   * 用于区分真实落账、幂等命中和失败，便于后台对账与补偿。
   */
  rewardResultType: smallint(),
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
   * 奖励结算时间。
   * 记录任务 bonus 最后一次成功或失败结算的处理时间。
   */
  rewardSettledAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 本次奖励关联到账本记录 ID 列表。
   * 仅记录任务 bonus 真正落账的流水，幂等命中时通常为空数组。
   */
  rewardLedgerIds: integer().array().default(sql`ARRAY[]::integer[]`).notNull(),
  /**
   * 上次奖励失败原因。
   * 仅在最近一次奖励补偿失败时保留，用于后台排障。
   */
  lastRewardError: varchar({ length: 500 }),
  /**
   * 创建时间。
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 更新时间。
   */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
  /**
   * 软删除时间。
   * 仅用于逻辑移除异常记录，正常历史审计通常依赖状态字段而不是物理删除。
   */
  deletedAt: timestamp({ withTimezone: true, precision: 6 }),
}, (table) => [
  /**
   * 任务、用户与周期唯一约束
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
   * 删除时间索引
   */
  index('task_assignment_deleted_at_idx').on(table.deletedAt),
  /**
   * 目标次数必须大于 0
   */
  check('task_assignment_target_positive_chk', sql`${table.target} > 0`),
]);

export type TaskAssignment = typeof taskAssignment.$inferSelect
export type TaskAssignmentSelect = TaskAssignment
export type TaskAssignmentInsert = typeof taskAssignment.$inferInsert
