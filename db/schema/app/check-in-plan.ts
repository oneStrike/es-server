import { sql } from 'drizzle-orm'
import {
  check,
  date,
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
 * 签到计划定义。
 *
 * 承载签到计划本身的运营配置，不直接记录用户签到事实；用户周期、签到记录和
 * 连续奖励发放分别由 `check_in_cycle`、`check_in_record` 和
 * `check_in_streak_reward_grant` 保存。
 */
export const checkInPlan = pgTable('check_in_plan', {
  /** 签到计划主键。 */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /** 签到计划稳定编码。 */
  planCode: varchar({ length: 50 }).notNull(),
  /** 签到计划名称。 */
  planName: varchar({ length: 200 }).notNull(),
  /** 计划状态（0=草稿，1=已发布，2=已下线，3=已停用）。 */
  status: smallint().default(0).notNull(),
  /** 周期类型（1=按周切分，2=按月切分）。 */
  cycleType: smallint().notNull(),
  /** 计划开始日期。 */
  startDate: date().notNull(),
  /** 每周期可补签次数。 */
  allowMakeupCountPerCycle: integer().default(0).notNull(),
  /**
   * 当前生效中的奖励定义。
   *
   * 保存默认基础奖励、具体日期奖励、周期模式奖励和连续奖励规则的单份定义。
   */
  rewardDefinition: jsonb(),
  /** 计划结束日期。 */
  endDate: date(),
  /** 创建人 ID。 */
  createdById: integer(),
  /** 更新人 ID。 */
  updatedById: integer(),
  /** 计划创建时间。 */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /** 计划最近更新时间。 */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
  /** 软删除时间。 */
  deletedAt: timestamp({ withTimezone: true, precision: 6 }),
}, (table) => [
  unique('check_in_plan_plan_code_key').on(table.planCode),
  index('check_in_plan_status_idx').on(table.status),
  index('check_in_plan_start_date_idx').on(table.startDate),
  index('check_in_plan_end_date_idx').on(table.endDate),
  index('check_in_plan_deleted_at_idx').on(table.deletedAt),
  check(
    'check_in_plan_allow_makeup_non_negative_chk',
    sql`${table.allowMakeupCountPerCycle} >= 0`,
  ),
  check(
    'check_in_plan_status_valid_chk',
    sql`${table.status} in (0, 1, 2, 3)`,
  ),
  check(
    'check_in_plan_cycle_type_valid_chk',
    sql`${table.cycleType} in (1, 2)`,
  ),
  check(
    'check_in_plan_date_range_valid_chk',
    sql`${table.endDate} is null or ${table.endDate} >= ${table.startDate}`,
  ),
])

export type CheckInPlan = typeof checkInPlan.$inferSelect
export type CheckInPlanSelect = CheckInPlan
export type CheckInPlanInsert = typeof checkInPlan.$inferInsert
