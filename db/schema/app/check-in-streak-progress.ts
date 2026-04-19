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
 * 用户连续奖励进度。
 *
 * 每个用户只绑定当前一个有效轮次配置，进度切换只能发生在首次绑定、迁移初始化
 * 或当前轮完成后的自动切轮；若绑定轮次已归档，则继续沿该轮持久化的后继链路推进。
 */
export const checkInStreakProgress = pgTable(
  'check_in_streak_progress',
  {
    /** 连续奖励进度主键。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 归属用户 ID。 */
    userId: integer().notNull(),
    /** 当前绑定的轮次配置 ID。 */
    roundConfigId: integer().notNull(),
    /** 当前轮次迭代号。 */
    roundIteration: integer().default(1).notNull(),
    /** 当前连续天数。 */
    currentStreak: integer().default(0).notNull(),
    /** 当前轮开始日期。 */
    roundStartedAt: date(),
    /** 最近一次有效签到日期。 */
    lastSignedDate: date(),
    /** 乐观锁版本号。 */
    version: integer().default(0).notNull(),
    /** 创建时间。 */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /** 更新时间。 */
    updatedAt: timestamp({ withTimezone: true, precision: 6 })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique('check_in_streak_progress_user_id_key').on(table.userId),
    index('check_in_streak_progress_round_config_id_idx').on(
      table.roundConfigId,
    ),
    check(
      'check_in_streak_progress_round_config_positive_chk',
      sql`${table.roundConfigId} > 0`,
    ),
    check(
      'check_in_streak_progress_round_iteration_positive_chk',
      sql`${table.roundIteration} > 0`,
    ),
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

export type CheckInStreakProgress = typeof checkInStreakProgress.$inferSelect
export type CheckInStreakProgressSelect = CheckInStreakProgress
export type CheckInStreakProgressInsert =
  typeof checkInStreakProgress.$inferInsert
