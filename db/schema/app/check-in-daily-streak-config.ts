import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  pgTable,
  smallint,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

/**
 * 日常连续签到配置版本。
 *
 * 全站同一时刻只允许一套日常连续签到规则对运行时生效；历史版本仅用于审计和奖励归因。
 */
export const checkInDailyStreakConfig = pgTable(
  'check_in_daily_streak_config',
  {
    /** 配置版本主键。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 版本号。 */
    version: integer().default(1).notNull(),
    /** 配置状态（0=草稿；1=已排期；2=生效中；3=已过期；4=已终止）。 */
    status: smallint().default(0).notNull(),
    /** 发布策略（1=立即生效；2=次日生效；3=指定时间生效）。 */
    publishStrategy: smallint().notNull(),
    /** 生效开始时间。 */
    effectiveFrom: timestamp({ withTimezone: true, precision: 6 }).notNull(),
    /** 生效结束时间。 */
    effectiveTo: timestamp({ withTimezone: true, precision: 6 }),
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
    unique('check_in_daily_streak_config_version_key').on(table.version),
    index('check_in_daily_streak_config_status_idx').on(table.status),
    index('check_in_daily_streak_config_effective_from_idx').on(
      table.effectiveFrom,
    ),
    index('check_in_daily_streak_config_effective_to_idx').on(
      table.effectiveTo,
    ),
    check(
      'check_in_daily_streak_config_version_positive_chk',
      sql`${table.version} > 0`,
    ),
    check(
      'check_in_daily_streak_config_status_valid_chk',
      sql`${table.status} in (0, 1, 2, 3, 4)`,
    ),
    check(
      'check_in_daily_streak_config_publish_strategy_valid_chk',
      sql`${table.publishStrategy} in (1, 2, 3)`,
    ),
    check(
      'check_in_daily_streak_config_effective_window_valid_chk',
      sql`${table.effectiveTo} is null or ${table.effectiveTo} > ${table.effectiveFrom}`,
    ),
  ],
)

export type CheckInDailyStreakConfig =
  typeof checkInDailyStreakConfig.$inferSelect
export type CheckInDailyStreakConfigSelect = CheckInDailyStreakConfig
export type CheckInDailyStreakConfigInsert =
  typeof checkInDailyStreakConfig.$inferInsert
