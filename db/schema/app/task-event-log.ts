import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  smallint,
  snakeCase,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 新任务模型中的事件与推进日志。
 *
 * 统一记录步骤推进、手动操作、拒绝原因与事件上下文，兼顾排障与对账。
 */
export const taskEventLog = snakeCase.table(
  'task_event_log',
  {
    /** 日志主键。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 所属任务头 ID。 */
    taskId: integer().notNull(),
    /** 所属步骤 ID。 */
    stepId: integer(),
    /** 关联的任务实例 ID。 */
    instanceId: integer(),
    /** 关联的实例步骤 ID。 */
    instanceStepId: integer(),
    /** 归属用户 ID。 */
    userId: integer().notNull(),
    /** 关联事件编码。 */
    eventCode: integer(),
    /** 关联事件业务键。 */
    eventBizKey: varchar({ length: 180 }),
    /** 日志动作类型。1=领取；2=进度推进；3=完成；4=过期；5=拒绝。 */
    actionType: smallint().notNull(),
    /** 推进来源。1=手动；2=事件驱动；3=系统。 */
    progressSource: smallint().default(1).notNull(),
    /** 本次日志是否被接受并真正计入状态推进。 */
    accepted: boolean().default(true).notNull(),
    /** 拒绝原因；开放值，由任务执行层约束。 */
    rejectReason: varchar({ length: 120 }),
    /** 变更值。 */
    delta: integer().default(0).notNull(),
    /** 变更前值。 */
    beforeValue: integer().default(0).notNull(),
    /** 变更后值。 */
    afterValue: integer().default(0).notNull(),
    /** 目标类型；开放值，由事件定义层约束。 */
    targetType: varchar({ length: 80 }),
    /** 目标 ID。 */
    targetId: integer(),
    /** 命中的唯一维度键。 */
    dimensionKey: varchar({ length: 80 }),
    /** 命中的唯一维度值。 */
    dimensionValue: varchar({ length: 255 }),
    /** 业务事件真实发生时间。 */
    occurredAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 日志上下文快照。 */
    context: jsonb(),
    /** 创建时间。 */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    /** 任务与创建时间索引。 */
    index('task_event_log_task_id_created_at_idx').on(
      table.taskId,
      table.createdAt,
    ),
    /** 实例索引。 */
    index('task_event_log_instance_id_idx').on(table.instanceId),
    /** 实例步骤索引。 */
    index('task_event_log_instance_step_id_idx').on(table.instanceStepId),
    /** 用户与创建时间索引。 */
    index('task_event_log_user_id_created_at_idx').on(
      table.userId,
      table.createdAt,
    ),
    /** 事件编码与创建时间索引。 */
    index('task_event_log_event_code_created_at_idx').on(
      table.eventCode,
      table.createdAt,
    ),
    check(
      'task_event_log_action_type_valid_chk',
      sql`${table.actionType} in (1, 2, 3, 4, 5)`,
    ),
    check(
      'task_event_log_progress_source_valid_chk',
      sql`${table.progressSource} in (1, 2, 3)`,
    ),
    check('task_event_log_delta_non_negative_chk', sql`${table.delta} >= 0`),
    check(
      'task_event_log_before_value_non_negative_chk',
      sql`${table.beforeValue} >= 0`,
    ),
    check(
      'task_event_log_after_value_non_negative_chk',
      sql`${table.afterValue} >= 0`,
    ),
    check(
      'task_event_log_event_code_positive_chk',
      sql`${table.eventCode} is null or ${table.eventCode} > 0`,
    ),
    check(
      'task_event_log_event_biz_key_not_blank_chk',
      sql`${table.eventBizKey} is null or btrim(${table.eventBizKey}) <> ''`,
    ),
    check(
      'task_event_log_reject_reason_not_blank_chk',
      sql`${table.rejectReason} is null or btrim(${table.rejectReason}) <> ''`,
    ),
    check(
      'task_event_log_target_type_not_blank_chk',
      sql`${table.targetType} is null or btrim(${table.targetType}) <> ''`,
    ),
    check(
      'task_event_log_target_id_positive_chk',
      sql`${table.targetId} is null or ${table.targetId} > 0`,
    ),
    check(
      'task_event_log_dimension_key_not_blank_chk',
      sql`${table.dimensionKey} is null or btrim(${table.dimensionKey}) <> ''`,
    ),
    check(
      'task_event_log_dimension_value_not_blank_chk',
      sql`${table.dimensionValue} is null or btrim(${table.dimensionValue}) <> ''`,
    ),
  ],
)

export type TaskEventLogSelect = typeof taskEventLog.$inferSelect
export type TaskEventLogInsert = typeof taskEventLog.$inferInsert
