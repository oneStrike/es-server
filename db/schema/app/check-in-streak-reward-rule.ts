import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 连续签到奖励规则。
 *
 * 每条规则定义某个计划下达到连续签到阈值后的奖励内容与是否允许重复触发。
 */
export const checkInStreakRewardRule = pgTable('check_in_streak_reward_rule', {
  /**
   * 连续奖励规则主键。
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 归属计划 ID。
   */
  planId: integer().notNull(),
  /**
   * 归属计划版本号。
   * 用于支持同一计划不同版本的连续奖励规则并存，避免更新配置污染历史周期。
   */
  planVersion: integer().notNull(),
  /**
   * 规则稳定编码。
   * 供后台配置与排障使用，同一计划内要求唯一。
   */
  ruleCode: varchar({ length: 50 }).notNull(),
  /**
   * 连续签到阈值天数。
   * 必须为大于 0 的整数，同一计划内不可重复。
   */
  streakDays: integer().notNull(),
  /**
   * 连续奖励配置。
   * 当前仅支持 `points` / `experience` 正整数，且不允许为空。
   */
  rewardConfig: jsonb().notNull(),
  /**
   * 是否允许重复领取。
   * `false` 表示同周期同规则最多发放一次。
   */
  repeatable: boolean().default(false).notNull(),
  /**
   * 规则状态。
   * 用于单条规则启停，不影响其他连续奖励规则的配置。
   */
  status: smallint().default(1).notNull(),
  /**
   * 规则创建时间。
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 规则最近更新时间。
   */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
  /**
   * 软删除时间。
   */
  deletedAt: timestamp({ withTimezone: true, precision: 6 }),
}, (table) => [
  /**
   * 同计划同规则编码唯一约束。
   */
  unique('check_in_streak_rule_plan_rule_code_key').on(
    table.planId,
    table.planVersion,
    table.ruleCode,
  ),
  /**
   * 同计划同阈值唯一约束。
   */
  unique('check_in_streak_rule_plan_streak_days_key').on(
    table.planId,
    table.planVersion,
    table.streakDays,
  ),
  /**
   * 计划与状态索引。
   */
  index('check_in_streak_rule_plan_id_status_idx').on(
    table.planId,
    table.planVersion,
    table.status,
  ),
  /**
   * 删除时间索引。
   */
  index('check_in_streak_rule_deleted_at_idx').on(table.deletedAt),
  /**
   * 连续阈值必须为正整数。
   */
  check('check_in_streak_rule_streak_days_positive_chk', sql`${table.streakDays} > 0`),
  /**
   * 计划版本必须为正整数。
   */
  check('check_in_streak_rule_plan_version_positive_chk', sql`${table.planVersion} > 0`),
  /**
   * 规则状态必须落在受支持枚举内。
   */
  check(
    'check_in_streak_rule_status_valid_chk',
    sql`${table.status} in (0, 1)`,
  ),
])

export type CheckInStreakRewardRule = typeof checkInStreakRewardRule.$inferSelect
export type CheckInStreakRewardRuleSelect = CheckInStreakRewardRule
export type CheckInStreakRewardRuleInsert = typeof checkInStreakRewardRule.$inferInsert
