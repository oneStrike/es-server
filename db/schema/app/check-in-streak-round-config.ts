import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  timestamp,
  uniqueIndex,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 连续奖励轮次配置。
 *
 * 管理当前轮及归档轮的后继接续关系，采用追加式版本模型，不允许原地改写。
 */
export const checkInStreakRoundConfig = pgTable(
  'check_in_streak_round_config',
  {
    /** 轮次配置主键。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 轮次编码。 */
    roundCode: varchar({ length: 50 }).notNull(),
    /** 同一轮次的版本号。 */
    version: integer().default(1).notNull(),
    /** 状态（0=草稿，1=已启用，2=已归档）。 */
    status: smallint().default(1).notNull(),
    /** 奖励规则列表。 */
    rewardRules: jsonb()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    /** 下一轮切换策略（1=沿用当前规则开启下一轮，2=显式后继轮次）。 */
    nextRoundStrategy: smallint().default(1).notNull(),
    /** 显式后继轮次配置 ID。 */
    nextRoundConfigId: integer(),
    /** 最近更新人 ID。 */
    updatedById: integer(),
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
    unique('check_in_streak_round_config_round_code_version_key').on(
      table.roundCode,
      table.version,
    ),
    uniqueIndex('check_in_streak_round_config_single_active_idx')
      .on(table.status)
      .where(sql`${table.status} = 1`),
    index('check_in_streak_round_config_status_idx').on(table.status),
    check(
      'check_in_streak_round_config_round_code_not_blank_chk',
      sql`btrim(${table.roundCode}) <> ''`,
    ),
    check(
      'check_in_streak_round_config_version_positive_chk',
      sql`${table.version} > 0`,
    ),
    check(
      'check_in_streak_round_config_status_valid_chk',
      sql`${table.status} in (0, 1, 2)`,
    ),
    check(
      'check_in_streak_round_config_next_round_strategy_valid_chk',
      sql`${table.nextRoundStrategy} in (1, 2)`,
    ),
    check(
      'check_in_streak_round_config_next_round_config_positive_chk',
      sql`${table.nextRoundConfigId} is null or ${table.nextRoundConfigId} > 0`,
    ),
  ],
)

export type CheckInStreakRoundConfig =
  typeof checkInStreakRoundConfig.$inferSelect
export type CheckInStreakRoundConfigSelect = CheckInStreakRoundConfig
export type CheckInStreakRoundConfigInsert =
  typeof checkInStreakRoundConfig.$inferInsert
