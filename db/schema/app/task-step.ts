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
 * 新任务模型中的步骤定义。
 *
 * 第一步正式能力仍只开放单步骤任务，但模型层保留步骤边界，便于未来扩展。
 */
export const taskStep = snakeCase.table(
  'task_step',
  {
    /** 步骤主键。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 所属任务头 ID。 */
    taskId: integer().notNull(),
    /** 任务内稳定步骤键。 */
    stepKey: varchar({ length: 50 }).notNull(),
    /** 步骤标题。 */
    title: varchar({ length: 200 }).notNull(),
    /** 步骤描述。 */
    description: varchar({ length: 1000 }),
    /** 步骤顺序。1=第一个步骤，依次递增。 */
    stepNo: smallint().notNull(),
    /** 触发方式。1=手动；2=事件驱动。 */
    triggerMode: smallint().notNull(),
    /** 目标事件编码；手动步骤为空。 */
    eventCode: integer(),
    /** 完成次数；必须为大于 0 的整数。 */
    targetValue: integer().default(1).notNull(),
    /** 事件模板键。 */
    templateKey: varchar({ length: 80 }),
    /** 步骤过滤配置；只允许由模板层生成的结构写入。 */
    filterPayload: jsonb(),
    /** 去重范围。1=按周期唯一；2=终身唯一。 */
    dedupeScope: smallint(),
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
    /** 同任务内步骤键唯一约束。 */
    unique('task_step_task_id_step_key_key').on(table.taskId, table.stepKey),
    /** 同任务内步骤顺序唯一约束。 */
    unique('task_step_task_id_step_no_key').on(table.taskId, table.stepNo),
    /** 任务索引。 */
    index('task_step_task_id_idx').on(table.taskId),
    /** 模板键索引。 */
    index('task_step_template_key_idx').on(table.templateKey),
    /** 事件编码索引。 */
    index('task_step_event_code_idx').on(table.eventCode),
    check('task_step_step_no_positive_chk', sql`${table.stepNo} > 0`),
    check(
      'task_step_trigger_mode_valid_chk',
      sql`${table.triggerMode} in (1, 2)`,
    ),
    check('task_step_target_value_positive_chk', sql`${table.targetValue} > 0`),
    check(
      'task_step_event_code_positive_chk',
      sql`${table.eventCode} is null or ${table.eventCode} > 0`,
    ),
    check(
      'task_step_step_key_not_blank_chk',
      sql`btrim(${table.stepKey}) <> ''`,
    ),
    check('task_step_title_not_blank_chk', sql`btrim(${table.title}) <> ''`),
    check(
      'task_step_template_key_not_blank_chk',
      sql`${table.templateKey} is null or btrim(${table.templateKey}) <> ''`,
    ),
    check(
      'task_step_dedupe_scope_valid_chk',
      sql`${table.dedupeScope} is null or ${table.dedupeScope} in (1, 2)`,
    ),
  ],
)

export type TaskStepSelect = typeof taskStep.$inferSelect
export type TaskStepInsert = typeof taskStep.$inferInsert
