import { sql } from 'drizzle-orm'
import {
  check,
  date,
  integer,
  snakeCase,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

/**
 * 连续签到用户进度。
 *
 * 运行时只记录用户当前连续状态，不再区分日常与活动两套进度。
 */
export const checkInStreakProgress = snakeCase.table(
  'check_in_streak_progress',
  {
    /** 进度主键。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 用户 ID。 */
    userId: integer().notNull(),
    /** 当前连续签到天数。 */
    currentStreak: integer().default(0).notNull(),
    /** 当前连续区间开始日期。 */
    streakStartedAt: date(),
    /** 最近一次有效签到日期。 */
    lastSignedDate: date(),
    /** 乐观锁版本号。 */
    version: integer().default(0).notNull(),
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
    unique('check_in_streak_progress_user_id_key').on(table.userId),
    check(
      'check_in_streak_progress_current_streak_non_negative_chk',
      sql`${table.currentStreak} >= 0`,
    ),
    check(
      'check_in_streak_progress_version_non_negative_chk',
      sql`${table.version} >= 0`,
    ),
  ],
)

export type CheckInStreakProgressSelect =
  typeof checkInStreakProgress.$inferSelect
export type CheckInStreakProgressInsert =
  typeof checkInStreakProgress.$inferInsert
