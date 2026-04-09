import { sql } from 'drizzle-orm'
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

/**
 * 签到具体日期奖励规则。
 *
 * 每条规则定义某个计划版本在指定自然日命中的基础奖励配置。
 * 命中时优先级高于周期模式奖励和计划默认基础奖励。
 */
export const checkInDateRewardRule = pgTable('check_in_date_reward_rule', {
  /**
   * 具体日期奖励规则主键。
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 归属计划 ID。
   */
  planId: integer().notNull(),
  /**
   * 归属计划版本号。
   * 计划奖励解释变化后通过新版本冻结，避免污染历史周期快照。
   */
  planVersion: integer().notNull(),
  /**
   * 命中的具体自然日。
   */
  rewardDate: date().notNull(),
  /**
   * 该自然日的基础奖励配置。
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
   * 同计划版本同具体日期唯一约束。
   */
  unique('check_in_date_reward_rule_plan_reward_date_key').on(
    table.planId,
    table.planVersion,
    table.rewardDate,
  ),
  /**
   * 计划与版本索引。
   */
  index('check_in_date_reward_rule_plan_id_version_idx').on(
    table.planId,
    table.planVersion,
  ),
  /**
   * 具体日期索引。
   */
  index('check_in_date_reward_rule_reward_date_idx').on(table.rewardDate),
  /**
   * 计划版本必须为正整数。
   */
  check(
    'check_in_date_reward_rule_plan_version_positive_chk',
    sql`${table.planVersion} > 0`,
  ),
])

export type CheckInDateRewardRule = typeof checkInDateRewardRule.$inferSelect
export type CheckInDateRewardRuleSelect = CheckInDateRewardRule
export type CheckInDateRewardRuleInsert = typeof checkInDateRewardRule.$inferInsert
