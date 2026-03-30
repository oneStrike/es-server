/**
 * Auto-converted from legacy schema.
 */

import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, smallint, timestamp, unique, varchar } from "drizzle-orm/pg-core";

/**
 * 任务分配记录
 */
export const taskAssignment = pgTable("task_assignment", {
  /**
   * 主键id
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 任务ID
   */
  taskId: integer().notNull(),
  /**
   * 用户ID
   */
  userId: integer().notNull(),
  /**
   * 周期标识
   */
  cycleKey: varchar({ length: 32 }).notNull(),
  /**
   * 分配状态
   */
  status: smallint().notNull(),
  /**
   * 奖励结算状态
   */
  rewardStatus: smallint().default(0).notNull(),
  /**
   * 奖励结算结果类型
   */
  rewardResultType: smallint(),
  /**
   * 当前进度
   */
  progress: integer().default(0).notNull(),
  /**
   * 目标次数
   */
  target: integer().default(1).notNull(),
  /**
   * 任务快照
   */
  taskSnapshot: jsonb(),
  /**
   * 任务上下文
   */
  context: jsonb(),
  /**
   * 版本号
   */
  version: integer().default(0).notNull(),
  /**
   * 领取时间
   */
  claimedAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 完成时间
   */
  completedAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 过期时间
   */
  expiredAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 奖励结算时间
   */
  rewardSettledAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 本次奖励关联到账本记录ID列表
   */
  rewardLedgerIds: integer().array().default(sql`ARRAY[]::integer[]`).notNull(),
  /**
   * 上次奖励失败原因
   */
  lastRewardError: varchar({ length: 500 }),
  /**
   * 创建时间
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 更新时间
   */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
  /**
   * 删除时间
   */
  deletedAt: timestamp({ withTimezone: true, precision: 6 }),
}, (table) => [
  /**
   * 任务、用户与周期唯一约束
   */
  unique("task_assignment_task_id_user_id_cycle_key_key").on(table.taskId, table.userId, table.cycleKey),
  /**
   * 用户与状态索引
   */
  index("task_assignment_user_id_status_idx").on(table.userId, table.status),
  /**
   * 任务索引
   */
  index("task_assignment_task_id_idx").on(table.taskId),
  /**
   * 完成时间索引
   */
  index("task_assignment_completed_at_idx").on(table.completedAt),
  /**
   * 过期时间索引
   */
  index("task_assignment_expired_at_idx").on(table.expiredAt),
  /**
   * 删除时间索引
   */
  index("task_assignment_deleted_at_idx").on(table.deletedAt),
]);

export type TaskAssignmentSelect = typeof taskAssignment.$inferSelect;
export type TaskAssignmentInsert = typeof taskAssignment.$inferInsert;
