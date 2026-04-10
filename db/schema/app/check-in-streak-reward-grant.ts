import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
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
 * 连续签到奖励发放事实。
 *
 * 当某次签到或补签重算后命中连续奖励阈值时，会创建对应发放事实并独立结算到账本。
 */
export const checkInStreakRewardGrant = pgTable('check_in_streak_reward_grant', {
  /** 连续奖励发放事实主键。 */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /** 发放归属用户 ID。 */
  userId: integer().notNull(),
  /** 发放归属计划 ID。 */
  planId: integer().notNull(),
  /** 发放归属周期 ID。 */
  cycleId: integer().notNull(),
  /** 命中的规则编码。 */
  ruleCode: varchar({ length: 50 }).notNull(),
  /** 命中的连续签到阈值。 */
  streakDays: integer().notNull(),
  /** 连续奖励配置快照。 */
  rewardConfig: jsonb().notNull(),
  /** 是否允许重复发放。 */
  repeatable: boolean().default(false).notNull(),
  /** 触发本次连续奖励的签到日期。 */
  triggerSignDate: date().notNull(),
  /** 连续奖励发放状态。 */
  grantStatus: smallint().default(0).notNull(),
  /** 连续奖励发放结果类型。 */
  grantResultType: smallint(),
  /** 业务幂等键。 */
  bizKey: varchar({ length: 200 }).notNull(),
  /** 连续奖励到账本记录 ID 列表。 */
  ledgerIds: integer().array().default(sql`ARRAY[]::integer[]`).notNull(),
  /** 最近一次连续奖励失败原因。 */
  lastGrantError: varchar({ length: 500 }),
  /** 发放扩展上下文。 */
  context: jsonb(),
  /** 最近一次发放状态落定时间。 */
  grantSettledAt: timestamp({ withTimezone: true, precision: 6 }),
  /** 发放事实创建时间。 */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /** 发放事实最近更新时间。 */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
}, (table) => [
  unique('check_in_streak_grant_user_biz_key_key').on(
    table.userId,
    table.bizKey,
  ),
  index('check_in_streak_grant_cycle_id_idx').on(table.cycleId),
  index('check_in_streak_grant_user_id_plan_id_idx').on(
    table.userId,
    table.planId,
  ),
  index('check_in_streak_grant_rule_code_idx').on(table.ruleCode),
  index('check_in_streak_grant_trigger_sign_date_idx').on(table.triggerSignDate),
  index('check_in_streak_grant_status_idx').on(table.grantStatus),
  check(
    'check_in_streak_grant_status_valid_chk',
    sql`${table.grantStatus} in (0, 1, 2)`,
  ),
  check(
    'check_in_streak_grant_result_type_valid_chk',
    sql`${table.grantResultType} is null or ${table.grantResultType} in (1, 2, 3)`,
  ),
  check(
    'check_in_streak_grant_state_consistent_chk',
    sql`(
      ${table.grantStatus} = 0
      and ${table.grantResultType} is null
      and ${table.grantSettledAt} is null
    ) or (
      ${table.grantStatus} = 1
      and ${table.grantResultType} in (1, 2)
      and ${table.grantSettledAt} is not null
    ) or (
      ${table.grantStatus} = 2
      and ${table.grantResultType} = 3
      and ${table.grantSettledAt} is not null
    )`,
  ),
  check(
    'check_in_streak_grant_streak_days_positive_chk',
    sql`${table.streakDays} > 0`,
  ),
])

export type CheckInStreakRewardGrant = typeof checkInStreakRewardGrant.$inferSelect
export type CheckInStreakRewardGrantSelect = CheckInStreakRewardGrant
export type CheckInStreakRewardGrantInsert = typeof checkInStreakRewardGrant.$inferInsert
