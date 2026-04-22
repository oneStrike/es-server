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
} from 'drizzle-orm/pg-core'

/**
 * 新任务模型中的实例步骤进度。
 *
 * 表示某个任务实例下，某个步骤当前的独立进度事实。
 */
export const taskInstanceStep = pgTable(
  'task_instance_step',
  {
    /** 实例步骤主键。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 归属任务实例 ID。 */
    instanceId: integer().notNull(),
    /** 归属步骤定义 ID。 */
    stepId: integer().notNull(),
    /** 步骤状态。0=待开始；1=进行中；2=已完成；3=已过期。 */
    status: smallint().notNull(),
    /** 当前进度值。 */
    currentValue: integer().default(0).notNull(),
    /** 目标值快照。 */
    targetValue: integer().default(1).notNull(),
    /** 完成时间。 */
    completedAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 步骤上下文。 */
    context: jsonb(),
    /** 乐观锁版本号。 */
    version: integer().default(0).notNull(),
    /** 创建时间。 */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /** 最近更新时间。 */
    updatedAt: timestamp({ withTimezone: true, precision: 6 })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    /** 同实例、同步骤唯一约束。 */
    unique('task_instance_step_instance_id_step_id_key').on(
      table.instanceId,
      table.stepId,
    ),
    /** 实例索引。 */
    index('task_instance_step_instance_id_idx').on(table.instanceId),
    /** 步骤索引。 */
    index('task_instance_step_step_id_idx').on(table.stepId),
    /** 完成时间索引。 */
    index('task_instance_step_completed_at_idx').on(table.completedAt),
    check(
      'task_instance_step_status_valid_chk',
      sql`${table.status} in (0, 1, 2, 3)`,
    ),
    check(
      'task_instance_step_current_value_non_negative_chk',
      sql`${table.currentValue} >= 0`,
    ),
    check(
      'task_instance_step_target_value_positive_chk',
      sql`${table.targetValue} > 0`,
    ),
    check(
      'task_instance_step_version_non_negative_chk',
      sql`${table.version} >= 0`,
    ),
  ],
)

export type TaskInstanceStepSelect = typeof taskInstanceStep.$inferSelect
export type TaskInstanceStepInsert = typeof taskInstanceStep.$inferInsert
