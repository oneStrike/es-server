import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

/**
 * 签到按日奖励规则。
 *
 * 每条规则定义某个计划版本在指定 `dayIndex` 上的基础奖励配置。
 * 当指定自然日命中规则时优先使用该配置，否则回退到计划默认基础奖励。
 */
export const checkInDailyRewardRule = pgTable('check_in_daily_reward_rule', {
  /**
   * 按日奖励规则主键。
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 归属计划 ID。
   */
  planId: integer().notNull(),
  /**
   * 归属计划版本号。
   * 计划关键配置变更后通过新版本规则冻结，避免污染历史周期解释。
   */
  planVersion: integer().notNull(),
  /**
   * 奖励天序号。
   * `weekly` 计划只允许 `1..7`，`monthly` 计划只允许 `1..31`，服务层再按周期类型做更严校验。
   */
  dayIndex: integer().notNull(),
  /**
   * 当天基础奖励配置。
   * 当前仅支持 `points` / `experience` 正整数，且不允许为空。
   */
  rewardConfig: jsonb().notNull(),
  /**
   * 规则创建时间。
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 规则最近更新时间。
   */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
}, (table) => [
  /**
   * 同计划版本同奖励天序号唯一约束。
   */
  unique('check_in_daily_reward_rule_plan_day_index_key').on(
    table.planId,
    table.planVersion,
    table.dayIndex,
  ),
  /**
   * 计划与版本索引。
   */
  index('check_in_daily_reward_rule_plan_id_version_idx').on(
    table.planId,
    table.planVersion,
  ),
  /**
   * 奖励天序号索引。
   */
  index('check_in_daily_reward_rule_day_index_idx').on(table.dayIndex),
  /**
   * 奖励天序号必须为 1..31 的正整数。
   */
  check(
    'check_in_daily_reward_rule_day_index_valid_chk',
    sql`${table.dayIndex} >= 1 and ${table.dayIndex} <= 31`,
  ),
  /**
   * 计划版本必须为正整数。
   */
  check(
    'check_in_daily_reward_rule_plan_version_positive_chk',
    sql`${table.planVersion} > 0`,
  ),
])

export type CheckInDailyRewardRule = typeof checkInDailyRewardRule.$inferSelect
export type CheckInDailyRewardRuleSelect = CheckInDailyRewardRule
export type CheckInDailyRewardRuleInsert = typeof checkInDailyRewardRule.$inferInsert
