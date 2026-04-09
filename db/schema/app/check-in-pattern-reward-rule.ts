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
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 签到周期模式奖励规则。
 *
 * 规则可表达“每周固定星期几”“每月固定几号”“每月最后一天”三类命中模式，
 * 优先级低于具体日期奖励，高于计划默认基础奖励。
 */
export const checkInPatternRewardRule = pgTable('check_in_pattern_reward_rule', {
  /**
   * 周期模式奖励规则主键。
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 归属计划 ID。
   */
  planId: integer().notNull(),
  /**
   * 归属计划版本号。
   */
  planVersion: integer().notNull(),
  /**
   * 规则模式类型。
   * 仅允许 `WEEKDAY` / `MONTH_DAY` / `MONTH_LAST_DAY`。
   */
  patternType: varchar({ length: 32 }).notNull(),
  /**
   * 星期值。
   * 仅当 `patternType=WEEKDAY` 时使用，1=周一，7=周日。
   */
  weekday: smallint(),
  /**
   * 每月几号。
   * 仅当 `patternType=MONTH_DAY` 时使用，取值范围为 1..31。
   */
  monthDay: smallint(),
  /**
   * 命中后的基础奖励配置。
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
   * 计划与版本索引。
   */
  index('check_in_pattern_reward_rule_plan_id_version_idx').on(
    table.planId,
    table.planVersion,
  ),
  /**
   * 规则类型索引。
   */
  index('check_in_pattern_reward_rule_pattern_type_idx').on(table.patternType),
  /**
   * 同计划版本同周几唯一。
   */
  uniqueIndex('check_in_pattern_reward_rule_weekday_key')
    .on(table.planId, table.planVersion, table.weekday)
    .where(sql`${table.patternType} = 'WEEKDAY'`),
  /**
   * 同计划版本同月内日期唯一。
   */
  uniqueIndex('check_in_pattern_reward_rule_month_day_key')
    .on(table.planId, table.planVersion, table.monthDay)
    .where(sql`${table.patternType} = 'MONTH_DAY'`),
  /**
   * 同计划版本最多允许一条“每月最后一天”规则。
   */
  uniqueIndex('check_in_pattern_reward_rule_month_last_day_key')
    .on(table.planId, table.planVersion)
    .where(sql`${table.patternType} = 'MONTH_LAST_DAY'`),
  /**
   * 计划版本必须为正整数。
   */
  check(
    'check_in_pattern_reward_rule_plan_version_positive_chk',
    sql`${table.planVersion} > 0`,
  ),
  /**
   * 规则类型必须落在受支持枚举内。
   */
  check(
    'check_in_pattern_reward_rule_pattern_type_valid_chk',
    sql`${table.patternType} in ('WEEKDAY', 'MONTH_DAY', 'MONTH_LAST_DAY')`,
  ),
  /**
   * WEEKDAY 规则必须只携带 `weekday`，且取值范围为 1..7。
   */
  check(
    'check_in_pattern_reward_rule_weekday_consistent_chk',
    sql`(
      ${table.patternType} <> 'WEEKDAY'
    ) or (
      ${table.weekday} between 1 and 7
      and ${table.monthDay} is null
    )`,
  ),
  /**
   * MONTH_DAY 规则必须只携带 `monthDay`，且取值范围为 1..31。
   */
  check(
    'check_in_pattern_reward_rule_month_day_consistent_chk',
    sql`(
      ${table.patternType} <> 'MONTH_DAY'
    ) or (
      ${table.monthDay} between 1 and 31
      and ${table.weekday} is null
    )`,
  ),
  /**
   * MONTH_LAST_DAY 规则不允许再携带其他命中参数。
   */
  check(
    'check_in_pattern_reward_rule_month_last_day_consistent_chk',
    sql`(
      ${table.patternType} <> 'MONTH_LAST_DAY'
    ) or (
      ${table.weekday} is null
      and ${table.monthDay} is null
    )`,
  ),
])

export type CheckInPatternRewardRule = typeof checkInPatternRewardRule.$inferSelect
export type CheckInPatternRewardRuleSelect = CheckInPatternRewardRule
export type CheckInPatternRewardRuleInsert = typeof checkInPatternRewardRule.$inferInsert
