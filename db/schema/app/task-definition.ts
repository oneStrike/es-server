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
 * 新任务模型中的任务头定义。
 *
 * 只承载运营侧可管理的任务头信息；步骤、实例和唯一计数事实分别由独立表承载。
 */
export const taskDefinition = pgTable(
  'task_definition',
  {
    /** 任务头主键。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 任务稳定编码；由服务端自动生成。 */
    code: varchar({ length: 50 }).notNull(),
    /** 任务标题。 */
    title: varchar({ length: 200 }).notNull(),
    /** 任务描述。 */
    description: varchar({ length: 1000 }),
    /** 任务封面。 */
    cover: varchar({ length: 255 }),
    /** 任务场景类型。1=新手引导；2=日常；4=活动。 */
    sceneType: smallint().notNull(),
    /** 任务状态。0=草稿；1=生效中；2=已暂停；3=已归档。 */
    status: smallint().notNull(),
    /** 排序值。0=默认排序，数值越小越靠前。 */
    sortOrder: smallint().default(0).notNull(),
    /** 领取方式。1=自动领取；2=手动领取。 */
    claimMode: smallint().notNull(),
    /** 完成聚合策略。1=所有步骤完成即完成。 */
    completionPolicy: smallint().default(1).notNull(),
    /** 重复周期类型。0=一次性；1=每日；2=每周；3=每月。 */
    repeatType: smallint().default(0).notNull(),
    /** 生效开始时间。 */
    startAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 生效结束时间。 */
    endAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 完成任务后统一发放的奖励项列表。 */
    rewardItems: jsonb(),
    /** 创建人 ID。 */
    createdById: integer(),
    /** 更新人 ID。 */
    updatedById: integer(),
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
    /** 任务稳定编码唯一约束。 */
    unique('task_definition_code_key').on(table.code),
    /** 状态索引。 */
    index('task_definition_status_idx').on(table.status),
    /** 场景类型索引。 */
    index('task_definition_scene_type_idx').on(table.sceneType),
    /** 排序值索引。 */
    index('task_definition_sort_order_idx').on(table.sortOrder),
    /** 生效开始时间索引。 */
    index('task_definition_start_at_idx').on(table.startAt),
    /** 生效结束时间索引。 */
    index('task_definition_end_at_idx').on(table.endAt),
    /** 删除时间索引。 */
    index('task_definition_deleted_at_idx').on(table.deletedAt),
    check(
      'task_definition_scene_type_valid_chk',
      sql`${table.sceneType} in (1, 2, 4)`,
    ),
    check(
      'task_definition_status_valid_chk',
      sql`${table.status} in (0, 1, 2, 3)`,
    ),
    check(
      'task_definition_sort_order_non_negative_chk',
      sql`${table.sortOrder} >= 0`,
    ),
    check(
      'task_definition_claim_mode_valid_chk',
      sql`${table.claimMode} in (1, 2)`,
    ),
    check(
      'task_definition_completion_policy_valid_chk',
      sql`${table.completionPolicy} in (1)`,
    ),
    check(
      'task_definition_repeat_type_valid_chk',
      sql`${table.repeatType} in (0, 1, 2, 3)`,
    ),
    check(
      'task_definition_code_not_blank_chk',
      sql`btrim(${table.code}) <> ''`,
    ),
    check(
      'task_definition_title_not_blank_chk',
      sql`btrim(${table.title}) <> ''`,
    ),
    check(
      'task_definition_publish_window_valid_chk',
      sql`${table.startAt} is null or ${table.endAt} is null or ${table.startAt} <= ${table.endAt}`,
    ),
  ],
)

export type TaskDefinitionSelect = typeof taskDefinition.$inferSelect
export type TaskDefinitionInsert = typeof taskDefinition.$inferInsert
