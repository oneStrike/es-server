import { sql } from 'drizzle-orm'
import {
  boolean,
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
 * 日常连续签到按天规则。
 *
 * 每条记录表达一个配置版本下“第 N 天”的奖励规则。
 */
export const checkInDailyStreakRule = pgTable(
  'check_in_daily_streak_rule',
  {
    /** 规则主键。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 所属日常连续签到配置 ID。 */
    configId: integer().notNull(),
    /** 规则稳定编码。 */
    ruleCode: varchar({ length: 50 }).notNull(),
    /** 连续签到天数。 */
    streakDays: integer().notNull(),
    /** 是否允许重复发放。 */
    repeatable: boolean().default(false).notNull(),
    /** 规则状态（0=停用；1=启用）。 */
    status: smallint().default(1).notNull(),
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
    unique('check_in_daily_streak_rule_config_streak_days_key').on(
      table.configId,
      table.streakDays,
    ),
    unique('check_in_daily_streak_rule_config_rule_code_key').on(
      table.configId,
      table.ruleCode,
    ),
    index('check_in_daily_streak_rule_config_id_idx').on(table.configId),
    check(
      'check_in_daily_streak_rule_config_id_positive_chk',
      sql`${table.configId} > 0`,
    ),
    check(
      'check_in_daily_streak_rule_streak_days_positive_chk',
      sql`${table.streakDays} > 0`,
    ),
    check(
      'check_in_daily_streak_rule_status_valid_chk',
      sql`${table.status} in (0, 1)`,
    ),
    check(
      'check_in_daily_streak_rule_rule_code_not_blank_chk',
      sql`btrim(${table.ruleCode}) <> ''`,
    ),
  ],
)

export type CheckInDailyStreakRule = typeof checkInDailyStreakRule.$inferSelect
export type CheckInDailyStreakRuleSelect = CheckInDailyStreakRule
export type CheckInDailyStreakRuleInsert =
  typeof checkInDailyStreakRule.$inferInsert
