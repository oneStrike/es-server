import { sql } from 'drizzle-orm'
import {
  check,
  date,
  index,
  integer,
  pgTable,
  smallint,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 签到计划定义。
 *
 * 承载签到计划本身的运营配置，不直接记录用户签到事实；用户周期、签到记录和
 * 连续奖励发放分别由 `check_in_cycle`、`check_in_record` 和
 * `check_in_streak_reward_grant` 保存。
 */
export const checkInPlan = pgTable('check_in_plan', {
  /**
   * 签到计划主键。
   * 仅用于内部关联与排障，不承载对外稳定编码语义。
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 签到计划稳定编码。
   * 供后台配置、灰度验证和外部系统引用，要求全局唯一。
   */
  planCode: varchar({ length: 50 }).notNull(),
  /**
   * 签到计划名称。
   * 直接用于 App/Admin 展示，历史周期展示依赖自身快照而不是回表读取本字段。
   */
  planName: varchar({ length: 200 }).notNull(),
  /**
   * 计划状态。
   * 作为计划唯一业务状态源，统一承载草稿、发布、停用、下线等生命周期语义。
   */
  status: smallint().default(0).notNull(),
  /**
   * 周期类型。
   * 一期只允许 `weekly`、`monthly` 两类稳定值。
   */
  cycleType: varchar({ length: 16 }).notNull(),
  /**
   * 计划开始日期。
   * 表示计划生效窗口起点，不再充当周期滚动锚点。
   */
  startDate: date().notNull(),
  /**
   * 每周期可补签次数。
   * 只限制当前周期内的补签额度，必须为非负整数。
   */
  allowMakeupCountPerCycle: integer().default(0).notNull(),
  /**
   * 计划版本号。
   * 关键配置变更后递增，新周期会冻结当前版本到 `check_in_cycle`。
   */
  version: integer().default(1).notNull(),
  /**
   * 计划结束日期。
   * `null` 表示长期有效；非空时计划在该自然日结束后失效。
   */
  endDate: date(),
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
   * 计划创建时间。
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 计划最近更新时间。
   */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
  /**
   * 软删除时间。
   * 非空表示该计划已从后台正常可见范围移除，但历史周期与签到事实仍保留。
   */
  deletedAt: timestamp({ withTimezone: true, precision: 6 }),
}, (table) => [
  /**
   * 计划稳定编码唯一约束。
   */
  unique('check_in_plan_plan_code_key').on(table.planCode),
  /**
   * 状态索引。
   */
  index('check_in_plan_status_idx').on(table.status),
  /**
   * 计划开始日期索引。
   */
  index('check_in_plan_start_date_idx').on(table.startDate),
  /**
   * 计划结束日期索引。
   */
  index('check_in_plan_end_date_idx').on(table.endDate),
  /**
   * 删除时间索引。
   */
  index('check_in_plan_deleted_at_idx').on(table.deletedAt),
  /**
   * 补签次数必须为非负整数。
   */
  check(
    'check_in_plan_allow_makeup_non_negative_chk',
    sql`${table.allowMakeupCountPerCycle} >= 0`,
  ),
  /**
   * 计划状态必须落在受支持枚举内。
   */
  check(
    'check_in_plan_status_valid_chk',
    sql`${table.status} in (0, 1, 2, 3)`,
  ),
  /**
   * 周期类型必须落在受支持枚举内。
   */
  check(
    'check_in_plan_cycle_type_valid_chk',
    sql`${table.cycleType} in ('weekly', 'monthly')`,
  ),
  /**
   * 计划版本必须为正整数。
   */
  check('check_in_plan_version_positive_chk', sql`${table.version} > 0`),
  /**
   * 计划结束日期不得早于开始日期。
   */
  check(
    'check_in_plan_date_range_valid_chk',
    sql`${table.endDate} is null or ${table.endDate} >= ${table.startDate}`,
  ),
])

export type CheckInPlan = typeof checkInPlan.$inferSelect
export type CheckInPlanSelect = CheckInPlan
export type CheckInPlanInsert = typeof checkInPlan.$inferInsert
