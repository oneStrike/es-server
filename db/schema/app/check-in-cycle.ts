import { sql } from 'drizzle-orm'
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 用户签到周期实例。
 *
 * 每条记录表示某个用户在某个签到计划下、某个周期切片中的聚合运行态，
 * 用于承载补签额度、连续天数与历史快照版本。
 */
export const checkInCycle = pgTable('check_in_cycle', {
  /**
   * 周期实例主键。
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 周期归属用户 ID。
   */
  userId: integer().notNull(),
  /**
   * 周期归属计划 ID。
   */
  planId: integer().notNull(),
  /**
   * 周期实例键。
   * 同用户同计划在同一周期内唯一，用于幂等创建与排障定位。
   */
  cycleKey: varchar({ length: 32 }).notNull(),
  /**
   * 周期开始日期。
   * 使用 `date` 语义表达当前周期的闭区间左边界。
   */
  cycleStartDate: date().notNull(),
  /**
   * 周期结束日期。
   * 使用 `date` 语义表达当前周期的闭区间右边界。
   */
  cycleEndDate: date().notNull(),
  /**
   * 当前周期已签天数。
   */
  signedCount: integer().default(0).notNull(),
  /**
   * 当前周期已使用补签次数。
   */
  makeupUsedCount: integer().default(0).notNull(),
  /**
   * 当前周期连续签到天数。
   * 由签到/补签事实重算后回写，用于摘要读取与阈值判断。
   */
  currentStreak: integer().default(0).notNull(),
  /**
   * 最近一次已纳入当前周期统计的签到日期。
   * 使用 `date` 语义冻结最近一次有效签到日。
   */
  lastSignedDate: date(),
  /**
   * 周期实际使用的计划快照版本。
   * 计划更新后，当前周期继续沿用自己的快照版本直到结束。
   */
  planSnapshotVersion: integer().notNull(),
  /**
   * 周期快照。
   * 至少冻结周期类型、计划起止日期、补签额度、按日奖励规则和连续奖励规则等关键字段。
   */
  planSnapshot: jsonb().notNull(),
  /**
   * 周期乐观锁版本号。
   * 用于并发签到与补签时避免聚合摘要互相覆盖。
   */
  version: integer().default(0).notNull(),
  /**
   * 周期创建时间。
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 周期最近更新时间。
   */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
}, (table) => [
  /**
   * 同用户、同计划、同周期唯一约束。
   */
  unique('check_in_cycle_user_plan_cycle_key_key').on(
    table.userId,
    table.planId,
    table.cycleKey,
  ),
  /**
   * 用户与计划索引。
   */
  index('check_in_cycle_user_id_plan_id_idx').on(table.userId, table.planId),
  /**
   * 周期开始日期索引。
   */
  index('check_in_cycle_cycle_start_date_idx').on(table.cycleStartDate),
  /**
   * 周期结束日期索引。
   */
  index('check_in_cycle_cycle_end_date_idx').on(table.cycleEndDate),
  /**
   * 已签天数必须为非负整数。
   */
  check('check_in_cycle_signed_count_non_negative_chk', sql`${table.signedCount} >= 0`),
  /**
   * 已用补签次数必须为非负整数。
   */
  check(
    'check_in_cycle_makeup_used_count_non_negative_chk',
    sql`${table.makeupUsedCount} >= 0`,
  ),
  /**
   * 连续签到天数必须为非负整数。
   */
  check(
    'check_in_cycle_current_streak_non_negative_chk',
    sql`${table.currentStreak} >= 0`,
  ),
  /**
   * 周期版本必须为非负整数。
   */
  check('check_in_cycle_version_non_negative_chk', sql`${table.version} >= 0`),
  /**
   * 最近签到日必须落在当前周期内。
   */
  check(
    'check_in_cycle_last_signed_date_in_cycle_chk',
    sql`${table.lastSignedDate} is null or (${table.lastSignedDate} >= ${table.cycleStartDate} and ${table.lastSignedDate} <= ${table.cycleEndDate})`,
  ),
  /**
   * 连续签到天数不得超过已签天数。
   */
  check(
    'check_in_cycle_current_streak_not_gt_signed_count_chk',
    sql`${table.currentStreak} <= ${table.signedCount}`,
  ),
  /**
   * 已用补签次数不得超过已签天数。
   */
  check(
    'check_in_cycle_makeup_used_count_not_gt_signed_count_chk',
    sql`${table.makeupUsedCount} <= ${table.signedCount}`,
  ),
  /**
   * 已签天数不得超过周期总天数。
   */
  check(
    'check_in_cycle_signed_count_not_gt_cycle_days_chk',
    sql`${table.signedCount} <= (${table.cycleEndDate} - ${table.cycleStartDate} + 1)`,
  ),
  /**
   * 周期快照版本必须为正整数。
   */
  check(
    'check_in_cycle_snapshot_version_positive_chk',
    sql`${table.planSnapshotVersion} > 0`,
  ),
  /**
   * 周期结束日期不得早于开始日期。
   */
  check(
    'check_in_cycle_date_range_valid_chk',
    sql`${table.cycleEndDate} >= ${table.cycleStartDate}`,
  ),
])

export type CheckInCycle = typeof checkInCycle.$inferSelect
export type CheckInCycleSelect = CheckInCycle
export type CheckInCycleInsert = typeof checkInCycle.$inferInsert
