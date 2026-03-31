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
   * 仅用于内部关联和后台运维，不承载业务语义。
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 任务稳定编码。
   * 用于后台配置、灰度排障和外部引用，要求全局唯一。
   */
  code: varchar({ length: 50 }).notNull(),
  /**
   * 任务标题。
   * 直接用于 app/admin 展示，变更不会影响历史 assignment 快照。
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
   * 任务场景类型。
   * 新写入只允许稳定值，历史兼容值在读层归一化处理。
   */
  type: smallint().notNull(),
  /**
   * 任务发布状态。
   * 草稿/发布/下线只影响模板可用性，不直接代表 assignment 执行状态。
   */
  status: smallint().notNull(),
  /**
   * 是否启用。
   * 用于紧急关闭任务模板，但保留配置与审计信息。
   */
  isEnabled: boolean().default(true).notNull(),
  /**
   * 任务优先级。
   * 数值越大越靠前，仅影响任务列表展示与自动领取处理顺序。
   */
  priority: smallint().default(0).notNull(),
  /**
   * 领取方式。
   * AUTO 会在读链路或事件链路中自动补齐 assignment。
   */
  claimMode: smallint().notNull(),
  /**
   * 完成方式。
   * AUTO 允许进度达标后直接进入完成态，MANUAL 需要显式 complete。
   */
  completeMode: smallint().notNull(),
  /**
   * 任务目标类型。
   * MANUAL 表示人工推进，EVENT_COUNT 表示由事件累计驱动。
   */
  objectiveType: smallint().default(1).notNull(),
  /**
   * 目标事件编码。
   * 仅 `objectiveType=EVENT_COUNT` 时有意义，映射成长事件定义中的稳定编码。
   */
  eventCode: integer(),
  /**
   * 目标次数。
   * 作为完成判定阈值，必须始终保持为大于 0 的整数。
   */
  targetCount: integer().default(1).notNull(),
  /**
   * 目标附加配置。
   * 用于约束事件上下文，例如限定某个业务子场景、资源范围或标签条件。
   */
  objectiveConfig: jsonb(),
  /**
   * 奖励配置。
   * 当前仅支持 `points` / `experience` 正整数，`null` 表示无任务奖励。
   */
  rewardConfig: jsonb(),
  /**
   * 重复规则。
   * `timezone` 仅影响周期切分和 cycleKey 计算，不改变时间字段的存储时区。
   */
  repeatRule: jsonb(),
  /**
   * 发布开始时间。
   * `null` 表示不限制开始时间，任务一旦发布即可参与领取/推进。
   */
  publishStartAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 发布结束时间。
   * `null` 表示不限制结束时间；存在值时会同步约束 assignment 的可用窗口。
   */
  publishEndAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 创建人 ID。
   * 仅用于后台审计，允许历史数据为空。
   */
  createdById: integer(),
  /**
   * 更新人 ID。
   * 仅用于后台审计，允许历史数据为空。
   */
  updatedById: integer(),
  /**
   * 模板创建时间。
   * 属于后台审计字段，不参与任务可用性判断。
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 模板最近更新时间。
   * 用于后台审计和排障，不作为任务周期边界。
   */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
  /**
   * 软删除时间。
   * 非空表示模板已从正常可见范围移除，但历史 assignment 与审计记录仍保留。
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
]);

export type Task = typeof task.$inferSelect
export type TaskSelect = Task
export type TaskInsert = typeof task.$inferInsert
