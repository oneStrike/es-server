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
 * 新任务模型中的唯一计数事实。
 *
 * 显式记录某用户在某步骤下已计入过的唯一对象，避免把“同对象只算一次”隐藏在事件幂等键语义里。
 */
export const taskStepUniqueFact = pgTable(
  'task_step_unique_fact',
  {
    /** 唯一计数事实主键。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 所属任务头 ID。 */
    taskId: integer().notNull(),
    /** 所属步骤 ID。 */
    stepId: integer().notNull(),
    /** 所属用户 ID。 */
    userId: integer().notNull(),
    /** 原始周期键；终身唯一时可为空。 */
    cycleKey: varchar({ length: 64 }),
    /** 去重范围。1=按周期唯一；2=终身唯一。 */
    dedupeScope: smallint().notNull(),
    /** 去重作用域键；按周期唯一时取周期键，终身唯一时取固定常量。 */
    scopeKey: varchar({ length: 64 }).notNull(),
    /** 唯一维度键。 */
    dimensionKey: varchar({ length: 80 }).notNull(),
    /** 唯一维度值快照。 */
    dimensionValue: varchar({ length: 255 }).notNull(),
    /** 唯一维度哈希。 */
    dimensionHash: varchar({ length: 120 }).notNull(),
    /** 首次命中事件编码。 */
    firstEventCode: integer(),
    /** 首次命中事件业务键。 */
    firstEventBizKey: varchar({ length: 180 }),
    /** 首次命中目标类型；开放值，由事件定义层约束。 */
    firstTargetType: varchar({ length: 80 }),
    /** 首次命中目标 ID。 */
    firstTargetId: integer(),
    /** 首次命中发生时间。 */
    firstOccurredAt: timestamp({ withTimezone: true, precision: 6 }).notNull(),
    /** 首次命中上下文快照。 */
    firstContext: jsonb(),
    /** 创建时间。 */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    /** 同步骤、同用户、同作用域、同唯一对象唯一约束。 */
    unique(
      'task_step_unique_fact_step_id_user_id_scope_key_dimension_hash_key',
    ).on(table.stepId, table.userId, table.scopeKey, table.dimensionHash),
    /** 用户与步骤索引。 */
    index('task_step_unique_fact_user_id_step_id_idx').on(
      table.userId,
      table.stepId,
    ),
    /** 任务索引。 */
    index('task_step_unique_fact_task_id_idx').on(table.taskId),
    /** 事件业务键索引。 */
    index('task_step_unique_fact_first_event_biz_key_idx').on(
      table.firstEventBizKey,
    ),
    check(
      'task_step_unique_fact_dedupe_scope_valid_chk',
      sql`${table.dedupeScope} in (1, 2)`,
    ),
    check(
      'task_step_unique_fact_scope_key_not_blank_chk',
      sql`btrim(${table.scopeKey}) <> ''`,
    ),
    check(
      'task_step_unique_fact_dimension_key_not_blank_chk',
      sql`btrim(${table.dimensionKey}) <> ''`,
    ),
    check(
      'task_step_unique_fact_dimension_value_not_blank_chk',
      sql`btrim(${table.dimensionValue}) <> ''`,
    ),
    check(
      'task_step_unique_fact_dimension_hash_not_blank_chk',
      sql`btrim(${table.dimensionHash}) <> ''`,
    ),
    check(
      'task_step_unique_fact_cycle_key_not_blank_chk',
      sql`${table.cycleKey} is null or btrim(${table.cycleKey}) <> ''`,
    ),
    check(
      'task_step_unique_fact_event_code_positive_chk',
      sql`${table.firstEventCode} is null or ${table.firstEventCode} > 0`,
    ),
    check(
      'task_step_unique_fact_event_biz_key_not_blank_chk',
      sql`${table.firstEventBizKey} is null or btrim(${table.firstEventBizKey}) <> ''`,
    ),
    check(
      'task_step_unique_fact_target_type_not_blank_chk',
      sql`${table.firstTargetType} is null or btrim(${table.firstTargetType}) <> ''`,
    ),
    check(
      'task_step_unique_fact_target_id_positive_chk',
      sql`${table.firstTargetId} is null or ${table.firstTargetId} > 0`,
    ),
  ],
)

export type TaskStepUniqueFactSelect = typeof taskStepUniqueFact.$inferSelect
export type TaskStepUniqueFactInsert = typeof taskStepUniqueFact.$inferInsert
