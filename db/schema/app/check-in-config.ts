import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  timestamp,
} from 'drizzle-orm/pg-core'

/**
 * 全局签到配置。
 *
 * 当前签到域只允许存在一套全局配置，不再保留多计划和未来生效时间窗语义。
 */
export const checkInConfig = pgTable(
  'check_in_config',
  {
    /** 全局签到配置主键。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 是否启用签到功能。 */
    isEnabled: smallint().default(1).notNull(),
    /** 补签周期类型（1=按自然周，2=按自然月）。 */
    makeupPeriodType: smallint().notNull(),
    /** 每周期系统发放的补签额度。 */
    periodicAllowance: integer().default(0).notNull(),
    /** 默认基础奖励项。 */
    baseRewardItems: jsonb(),
    /** 具体日期奖励规则列表。 */
    dateRewardRules: jsonb()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    /** 周期模式奖励规则列表。 */
    patternRewardRules: jsonb()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    /** 最近更新人 ID。 */
    updatedById: integer(),
    /** 配置创建时间。 */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /** 配置更新时间。 */
    updatedAt: timestamp({ withTimezone: true, precision: 6 })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('check_in_config_is_enabled_idx').on(table.isEnabled),
    check(
      'check_in_config_is_enabled_valid_chk',
      sql`${table.isEnabled} in (0, 1)`,
    ),
    check(
      'check_in_config_makeup_period_type_valid_chk',
      sql`${table.makeupPeriodType} in (1, 2)`,
    ),
    check(
      'check_in_config_periodic_allowance_non_negative_chk',
      sql`${table.periodicAllowance} >= 0`,
    ),
  ],
)

export type CheckInConfig = typeof checkInConfig.$inferSelect
export type CheckInConfigSelect = CheckInConfig
export type CheckInConfigInsert = typeof checkInConfig.$inferInsert
