import { sql } from 'drizzle-orm'
import {
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
  /**
   * 连续奖励发放事实主键。
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 发放归属用户 ID。
   */
  userId: integer().notNull(),
  /**
   * 发放归属计划 ID。
   */
  planId: integer().notNull(),
  /**
   * 发放归属周期 ID。
   */
  cycleId: integer().notNull(),
  /**
   * 命中的连续奖励规则 ID。
   */
  ruleId: integer().notNull(),
  /**
   * 触发本次连续奖励的签到日期。
   * 使用 `date` 语义冻结阈值命中的自然日。
   */
  triggerSignDate: date().notNull(),
  /**
   * 连续奖励发放状态。
   */
  grantStatus: smallint().default(0).notNull(),
  /**
   * 连续奖励发放结果类型。
   */
  grantResultType: smallint(),
  /**
   * 业务幂等键。
   * 同一用户下要求稳定且唯一，用于重放补偿与避免重复落账。
   */
  bizKey: varchar({ length: 200 }).notNull(),
  /**
   * 连续奖励到账本记录 ID 列表。
   */
  ledgerIds: integer().array().default(sql`ARRAY[]::integer[]`).notNull(),
  /**
   * 最近一次连续奖励失败原因。
   */
  lastGrantError: varchar({ length: 500 }),
  /**
   * 发放事实对应的计划快照版本。
   */
  planSnapshotVersion: integer().notNull(),
  /**
   * 发放扩展上下文。
   * 可保存补偿来源、命中阈值快照与排障信息。
   */
  context: jsonb(),
  /**
   * 最近一次发放状态落定时间。
   */
  grantSettledAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 发放事实创建时间。
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 发放事实最近更新时间。
   */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
}, (table) => [
  /**
   * 同用户业务幂等键唯一约束。
   */
  unique('check_in_streak_grant_user_biz_key_key').on(
    table.userId,
    table.bizKey,
  ),
  /**
   * 周期索引。
   */
  index('check_in_streak_grant_cycle_id_idx').on(table.cycleId),
  /**
   * 用户与计划索引。
   */
  index('check_in_streak_grant_user_id_plan_id_idx').on(
    table.userId,
    table.planId,
  ),
  /**
   * 规则索引。
   */
  index('check_in_streak_grant_rule_id_idx').on(table.ruleId),
  /**
   * 触发日期索引。
   */
  index('check_in_streak_grant_trigger_sign_date_idx').on(table.triggerSignDate),
  /**
   * 发放状态索引。
   */
  index('check_in_streak_grant_status_idx').on(table.grantStatus),
  /**
   * 发放状态必须落在受支持枚举内。
   */
  check(
    'check_in_streak_grant_status_valid_chk',
    sql`${table.grantStatus} in (0, 1, 2)`,
  ),
  /**
   * 发放结果类型必须落在受支持枚举内或为空。
   */
  check(
    'check_in_streak_grant_result_type_valid_chk',
    sql`${table.grantResultType} is null or ${table.grantResultType} in (1, 2, 3)`,
  ),
  /**
   * 发放状态、结果类型和落定时间必须保持一致。
   */
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
  /**
   * 快照版本必须为正整数。
   */
  check(
    'check_in_streak_grant_snapshot_version_positive_chk',
    sql`${table.planSnapshotVersion} > 0`,
  ),
])

export type CheckInStreakRewardGrant = typeof checkInStreakRewardGrant.$inferSelect
export type CheckInStreakRewardGrantSelect = CheckInStreakRewardGrant
export type CheckInStreakRewardGrantInsert = typeof checkInStreakRewardGrant.$inferInsert
