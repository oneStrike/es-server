import { sql } from 'drizzle-orm'
import {
  check,
  date,
  index,
  integer,
  pgTable,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

/**
 * 活动连续签到用户进度。
 *
 * 进度按 `activityId + userId` 维度维护，与日常连续签到完全隔离。
 */
export const checkInActivityStreakProgress = pgTable(
  'check_in_activity_streak_progress',
  {
    /** 进度主键。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 活动 ID。 */
    activityId: integer().notNull(),
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
    unique('check_in_activity_streak_progress_activity_user_key').on(
      table.activityId,
      table.userId,
    ),
    index('check_in_activity_streak_progress_activity_id_idx').on(
      table.activityId,
    ),
    index('check_in_activity_streak_progress_user_id_idx').on(table.userId),
    check(
      'check_in_activity_streak_progress_activity_id_positive_chk',
      sql`${table.activityId} > 0`,
    ),
    check(
      'check_in_activity_streak_progress_current_streak_non_negative_chk',
      sql`${table.currentStreak} >= 0`,
    ),
    check(
      'check_in_activity_streak_progress_version_non_negative_chk',
      sql`${table.version} >= 0`,
    ),
  ],
)

export type CheckInActivityStreakProgress =
  typeof checkInActivityStreakProgress.$inferSelect
export type CheckInActivityStreakProgressSelect =
  typeof checkInActivityStreakProgress.$inferSelect
export type CheckInActivityStreakProgressInsert =
  typeof checkInActivityStreakProgress.$inferInsert
