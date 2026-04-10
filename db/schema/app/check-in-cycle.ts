import { sql } from 'drizzle-orm'
import {
  check,
  date,
  index,
  integer,
  pgTable,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 用户签到周期实例。
 *
 * 每条记录表示某个用户在某个签到计划下、某个周期切片中的聚合运行态，
 * 仅保存进度摘要，不再冻结计划快照。
 */
export const checkInCycle = pgTable('check_in_cycle', {
  /** 周期实例主键。 */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /** 周期归属用户 ID。 */
  userId: integer().notNull(),
  /** 周期归属计划 ID。 */
  planId: integer().notNull(),
  /** 周期实例键。 */
  cycleKey: varchar({ length: 32 }).notNull(),
  /** 周期开始日期。 */
  cycleStartDate: date().notNull(),
  /** 周期结束日期。 */
  cycleEndDate: date().notNull(),
  /** 当前周期已签天数。 */
  signedCount: integer().default(0).notNull(),
  /** 当前周期已使用补签次数。 */
  makeupUsedCount: integer().default(0).notNull(),
  /** 当前周期连续签到天数。 */
  currentStreak: integer().default(0).notNull(),
  /** 最近一次有效签到日期。 */
  lastSignedDate: date(),
  /** 周期乐观锁版本号。 */
  version: integer().default(0).notNull(),
  /** 周期创建时间。 */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /** 周期最近更新时间。 */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
}, (table) => [
  unique('check_in_cycle_user_plan_cycle_key_key').on(
    table.userId,
    table.planId,
    table.cycleKey,
  ),
  index('check_in_cycle_user_id_plan_id_idx').on(table.userId, table.planId),
  index('check_in_cycle_cycle_start_date_idx').on(table.cycleStartDate),
  index('check_in_cycle_cycle_end_date_idx').on(table.cycleEndDate),
  check('check_in_cycle_signed_count_non_negative_chk', sql`${table.signedCount} >= 0`),
  check(
    'check_in_cycle_makeup_used_count_non_negative_chk',
    sql`${table.makeupUsedCount} >= 0`,
  ),
  check(
    'check_in_cycle_current_streak_non_negative_chk',
    sql`${table.currentStreak} >= 0`,
  ),
  check('check_in_cycle_version_non_negative_chk', sql`${table.version} >= 0`),
  check(
    'check_in_cycle_last_signed_date_in_cycle_chk',
    sql`${table.lastSignedDate} is null or (${table.lastSignedDate} >= ${table.cycleStartDate} and ${table.lastSignedDate} <= ${table.cycleEndDate})`,
  ),
  check(
    'check_in_cycle_current_streak_not_gt_signed_count_chk',
    sql`${table.currentStreak} <= ${table.signedCount}`,
  ),
  check(
    'check_in_cycle_makeup_used_count_not_gt_signed_count_chk',
    sql`${table.makeupUsedCount} <= ${table.signedCount}`,
  ),
  check(
    'check_in_cycle_signed_count_not_gt_cycle_days_chk',
    sql`${table.signedCount} <= (${table.cycleEndDate} - ${table.cycleStartDate} + 1)`,
  ),
  check(
    'check_in_cycle_date_range_valid_chk',
    sql`${table.cycleEndDate} >= ${table.cycleStartDate}`,
  ),
])

export type CheckInCycle = typeof checkInCycle.$inferSelect
export type CheckInCycleSelect = CheckInCycle
export type CheckInCycleInsert = typeof checkInCycle.$inferInsert
