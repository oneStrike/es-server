import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  pgTable,
  smallint,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 活动连续签到定义。
 *
 * 活动连续签到独立于日常连续签到，拥有自己的时间窗口、规则与状态。
 */
export const checkInActivityStreak = pgTable(
  'check_in_activity_streak',
  {
    /** 活动主键。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 活动稳定键。 */
    activityKey: varchar({ length: 80 }).notNull(),
    /** 活动标题。 */
    title: varchar({ length: 120 }).notNull(),
    /** 活动状态（0=草稿；1=已发布；2=已下线；3=已归档）。 */
    status: smallint().default(0).notNull(),
    /** 活动开始时间。 */
    effectiveFrom: timestamp({ withTimezone: true, precision: 6 }).notNull(),
    /** 活动结束时间。 */
    effectiveTo: timestamp({ withTimezone: true, precision: 6 }).notNull(),
    /** 最近更新人 ID。 */
    updatedById: integer(),
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
    unique('check_in_activity_streak_activity_key_key').on(table.activityKey),
    index('check_in_activity_streak_status_idx').on(table.status),
    index('check_in_activity_streak_effective_from_idx').on(
      table.effectiveFrom,
    ),
    index('check_in_activity_streak_effective_to_idx').on(table.effectiveTo),
    check(
      'check_in_activity_streak_activity_key_not_blank_chk',
      sql`btrim(${table.activityKey}) <> ''`,
    ),
    check(
      'check_in_activity_streak_title_not_blank_chk',
      sql`btrim(${table.title}) <> ''`,
    ),
    check(
      'check_in_activity_streak_status_valid_chk',
      sql`${table.status} in (0, 1, 2, 3)`,
    ),
    check(
      'check_in_activity_streak_effective_window_valid_chk',
      sql`${table.effectiveTo} > ${table.effectiveFrom}`,
    ),
  ],
)

export type CheckInActivityStreak = typeof checkInActivityStreak.$inferSelect
export type CheckInActivityStreakSelect = CheckInActivityStreak
export type CheckInActivityStreakInsert =
  typeof checkInActivityStreak.$inferInsert
