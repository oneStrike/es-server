import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 连续签到奖励发放事实。
 *
 * 统一记录单一连续签到模型下的奖励发放头信息。
 */
export const checkInStreakGrant = pgTable(
  'check_in_streak_grant',
  {
    /** 发放事实主键。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 发放归属用户 ID。 */
    userId: integer().notNull(),
    /** 归属规则 ID。 */
    ruleId: integer().notNull(),
    /** 命中的规则编码快照。 */
    ruleCode: varchar({ length: 50 }).notNull(),
    /** 命中的连续签到阈值快照。 */
    streakDays: integer().notNull(),
    /** 是否允许重复发放。 */
    repeatable: boolean().default(false).notNull(),
    /** 触发本次奖励的签到日期。 */
    triggerSignDate: date().notNull(),
    /** 关联的奖励结算记录 ID。 */
    rewardSettlementId: integer(),
    /** 幂等业务键。 */
    bizKey: varchar({ length: 200 }).notNull(),
    /** 扩展上下文。 */
    context: jsonb(),
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
    unique('check_in_streak_grant_user_biz_key_key').on(
      table.userId,
      table.bizKey,
    ),
    index('check_in_streak_grant_rule_id_idx').on(table.ruleId),
    index('check_in_streak_grant_user_trigger_sign_date_idx').on(
      table.userId,
      table.triggerSignDate,
    ),
    index('check_in_streak_grant_reward_settlement_id_idx').on(
      table.rewardSettlementId,
    ),
    check(
      'check_in_streak_grant_rule_id_positive_chk',
      sql`${table.ruleId} > 0`,
    ),
    check(
      'check_in_streak_grant_streak_days_positive_chk',
      sql`${table.streakDays} > 0`,
    ),
    check(
      'check_in_streak_grant_reward_settlement_id_positive_chk',
      sql`${table.rewardSettlementId} is null or ${table.rewardSettlementId} > 0`,
    ),
  ],
)

export type CheckInStreakGrant = typeof checkInStreakGrant.$inferSelect
export type CheckInStreakGrantSelect = CheckInStreakGrant
export type CheckInStreakGrantInsert = typeof checkInStreakGrant.$inferInsert
