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
 * 连续签到按天规则。
 *
 * 每条记录独立维护某个连续签到天阈值的生命周期与奖励定义。
 */
export const checkInStreakRule = pgTable(
  'check_in_streak_rule',
  {
    /** 规则主键。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 规则稳定编码。 */
    ruleCode: varchar({ length: 50 }).notNull(),
    /** 连续签到天数。 */
    streakDays: integer().notNull(),
    /** 规则版本号。 */
    version: integer().default(1).notNull(),
    /** 生命周期状态（0=草稿；1=已排期；2=生效中；3=已过期；4=已终止）。 */
    status: smallint().default(0).notNull(),
    /** 发布策略（1=立即生效；2=次日生效；3=指定时间生效）。 */
    publishStrategy: smallint().notNull(),
    /** 生效开始时间。 */
    effectiveFrom: timestamp({ withTimezone: true, precision: 6 }).notNull(),
    /** 生效结束时间。 */
    effectiveTo: timestamp({ withTimezone: true, precision: 6 }),
    /** 是否允许重复发放。 */
    repeatable: boolean().default(false).notNull(),
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
    unique('check_in_streak_rule_rule_code_version_key').on(
      table.ruleCode,
      table.version,
    ),
    unique('check_in_streak_rule_rule_code_effective_from_key').on(
      table.ruleCode,
      table.effectiveFrom,
    ),
    index('check_in_streak_rule_rule_code_idx').on(table.ruleCode),
    index('check_in_streak_rule_streak_days_idx').on(table.streakDays),
    index('check_in_streak_rule_status_idx').on(table.status),
    index('check_in_streak_rule_effective_from_idx').on(table.effectiveFrom),
    index('check_in_streak_rule_effective_to_idx').on(table.effectiveTo),
    check(
      'check_in_streak_rule_streak_days_positive_chk',
      sql`${table.streakDays} > 0`,
    ),
    check(
      'check_in_streak_rule_version_positive_chk',
      sql`${table.version} > 0`,
    ),
    check(
      'check_in_streak_rule_status_valid_chk',
      sql`${table.status} in (0, 1, 2, 3, 4)`,
    ),
    check(
      'check_in_streak_rule_publish_strategy_valid_chk',
      sql`${table.publishStrategy} in (1, 2, 3)`,
    ),
    check(
      'check_in_streak_rule_effective_window_valid_chk',
      sql`${table.effectiveTo} is null or ${table.effectiveTo} > ${table.effectiveFrom}`,
    ),
    check(
      'check_in_streak_rule_rule_code_not_blank_chk',
      sql`btrim(${table.ruleCode}) <> ''`,
    ),
  ],
)

export type CheckInStreakRuleSelect = typeof checkInStreakRule.$inferSelect
export type CheckInStreakRuleInsert = typeof checkInStreakRule.$inferInsert
