import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  smallint,
  snakeCase,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 新任务模型中的用户任务实例。
 *
 * 表示某用户在某个周期内命中的一次任务实例；具体步骤进度由 `task_instance_step` 承载。
 */
export const taskInstance = snakeCase.table(
  'task_instance',
  {
    /** 实例主键。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 归属任务头 ID。 */
    taskId: integer().notNull(),
    /** 归属用户 ID。 */
    userId: integer().notNull(),
    /** 周期键；一次性任务仍使用稳定常量值。 */
    cycleKey: varchar({ length: 64 }).notNull(),
    /** 实例状态。0=已领取待开始；1=进行中；2=已完成；3=已过期。 */
    status: smallint().notNull(),
    /** 是否需要奖励结算。0=无奖励；1=需要奖励结算。 */
    rewardApplicable: smallint().default(0).notNull(),
    /** 关联的奖励结算事实 ID。 */
    rewardSettlementId: integer(),
    /** 任务头快照。 */
    snapshotPayload: jsonb(),
    /** 实例上下文。 */
    context: jsonb(),
    /** 乐观锁版本号。 */
    version: integer().default(0).notNull(),
    /** 领取时间。 */
    claimedAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 完成时间。 */
    completedAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 过期时间。 */
    expiredAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 创建时间。 */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /** 最近更新时间。 */
    updatedAt: timestamp({ withTimezone: true, precision: 6 })
      .$onUpdate(() => new Date())
      .notNull(),
    /** 软删除时间。 */
    deletedAt: timestamp({ withTimezone: true, precision: 6 }),
  },
  (table) => [
    /** 同用户、同任务、同周期唯一约束。 */
    unique('task_instance_task_id_user_id_cycle_key_key').on(
      table.taskId,
      table.userId,
      table.cycleKey,
    ),
    /** 用户与状态索引。 */
    index('task_instance_user_id_status_idx').on(table.userId, table.status),
    /** 任务索引。 */
    index('task_instance_task_id_idx').on(table.taskId),
    /** 完成时间索引。 */
    index('task_instance_completed_at_idx').on(table.completedAt),
    /** 过期时间索引。 */
    index('task_instance_expired_at_idx').on(table.expiredAt),
    /** 奖励结算索引。 */
    index('task_instance_reward_settlement_id_idx').on(
      table.rewardSettlementId,
    ),
    /** 删除时间索引。 */
    index('task_instance_deleted_at_idx').on(table.deletedAt),
    check(
      'task_instance_cycle_key_not_blank_chk',
      sql`btrim(${table.cycleKey}) <> ''`,
    ),
    check(
      'task_instance_status_valid_chk',
      sql`${table.status} in (0, 1, 2, 3)`,
    ),
    check(
      'task_instance_reward_applicable_valid_chk',
      sql`${table.rewardApplicable} in (0, 1)`,
    ),
    check('task_instance_version_non_negative_chk', sql`${table.version} >= 0`),
    check(
      'task_instance_reward_settlement_id_positive_chk',
      sql`${table.rewardSettlementId} is null or ${table.rewardSettlementId} > 0`,
    ),
  ],
)

export type TaskInstanceSelect = typeof taskInstance.$inferSelect
export type TaskInstanceInsert = typeof taskInstance.$inferInsert
