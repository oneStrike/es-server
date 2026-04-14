import { sql } from 'drizzle-orm'
import {
  boolean,
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
 * 任务定义。
 *
 * 存储任务模板本身，不直接记录用户执行状态；用户领取和进度由 `task_assignment`
 * 与 `task_progress_log` 承载。
 */
export const task = pgTable('task', {
  /**
   * 任务模板主键。
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 任务稳定编码。
   */
  code: varchar({ length: 50 }).notNull(),
  /**
   * 任务标题。
   */
  title: varchar({ length: 200 }).notNull(),
  /**
   * 任务描述
   */
  description: varchar({ length: 1000 }),
  /**
   * 任务封面
   */
  cover: varchar({ length: 255 }),
  /**
   * 任务场景类型。1=新手引导任务，2=日常任务，4=活动任务。
   */
  type: smallint().notNull(),
  /**
   * 任务发布状态。0=草稿，1=已发布，2=已下线。
   */
  status: smallint().notNull(),
  /**
   * 是否启用。
   */
  isEnabled: boolean().default(true).notNull(),
  /**
   * 任务优先级。0=默认优先级，数值越大越靠前。
   */
  priority: smallint().default(0).notNull(),
  /**
   * 领取方式。1=自动领取，2=手动领取。
   */
  claimMode: smallint().notNull(),
  /**
   * 完成方式。1=自动完成，2=手动完成。
   */
  completeMode: smallint().notNull(),
  /**
   * 任务目标类型。 1=手动推进，2=事件累计次数驱动。
   */
  objectiveType: smallint().default(1).notNull(),
  /**
   * 目标事件编码。
   */
  eventCode: integer(),
  /**
   * 目标次数。
   */
  targetCount: integer().default(1).notNull(),
  /**
   * 目标附加配置。
   */
  objectiveConfig: jsonb(),
  /**
   * 奖励配置。
   */
  rewardConfig: jsonb(),
  /**
   * 重复规则。
   */
  repeatRule: jsonb(),
  /**
   * 发布开始时间。
   */
  publishStartAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 发布结束时间。
   */
  publishEndAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 创建人 ID。
   */
  createdById: integer(),
  /**
   * 更新人 ID。
   */
  updatedById: integer(),
  /**
   * 模板创建时间。
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 模板最近更新时间。
   */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
  /**
   * 软删除时间。
   */
  deletedAt: timestamp({ withTimezone: true, precision: 6 }),
}, (table) => [
  /**
   * 任务稳定编码唯一约束。
   */
  unique('task_code_key').on(table.code),
  /**
   * 状态与启用索引
   */
  index('task_status_is_enabled_idx').on(table.status, table.isEnabled),
  /**
   * 任务场景类型索引
   */
  index('task_type_idx').on(table.type),
  /**
   * 任务目标类型索引
   */
  index('task_objective_type_idx').on(table.objectiveType),
  /**
   * 目标事件编码索引
   */
  index('task_event_code_idx').on(table.eventCode),
  /**
   * 发布开始时间索引
   */
  index('task_publish_start_at_idx').on(table.publishStartAt),
  /**
   * 发布结束时间索引
   */
  index('task_publish_end_at_idx').on(table.publishEndAt),
  /**
   * 创建时间索引
   */
  index('task_created_at_idx').on(table.createdAt),
  /**
   * 删除时间索引
   */
  index('task_deleted_at_idx').on(table.deletedAt),
  /**
   * 目标次数必须大于 0
   */
  check('task_target_count_positive_chk', sql`${table.targetCount} > 0`),
  /**
   * 任务场景类型值域约束
   */
  check('task_type_valid_chk', sql`${table.type} in (1, 2, 4)`),
  /**
   * 任务状态值域约束
   */
  check('task_status_valid_chk', sql`${table.status} in (0, 1, 2)`),
  /**
   * 优先级不能为负数
   */
  check('task_priority_non_negative_chk', sql`${table.priority} >= 0`),
  /**
   * 领取方式值域约束
   */
  check('task_claim_mode_valid_chk', sql`${table.claimMode} in (1, 2)`),
  /**
   * 完成方式值域约束
   */
  check('task_complete_mode_valid_chk', sql`${table.completeMode} in (1, 2)`),
  /**
   * 目标类型值域约束
   */
  check('task_objective_type_valid_chk', sql`${table.objectiveType} in (1, 2)`),
]);

export type Task = typeof task.$inferSelect
export type TaskSelect = Task
export type TaskInsert = typeof task.$inferInsert
