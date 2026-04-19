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
 * 当某次签到或补签命中当前轮次奖励阈值时，会创建对应发放事实并独立结算到账本。
 */
export const checkInStreakRewardGrant = pgTable(
  'check_in_streak_reward_grant',
  {
    /** 连续奖励发放事实主键。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 发放归属用户 ID。 */
    userId: integer().notNull(),
    /** 发放时绑定的轮次配置 ID。 */
    roundConfigId: integer().notNull(),
    /** 命中时所在的轮次迭代号。 */
    roundIteration: integer().default(1).notNull(),
    /** 命中的规则编码。 */
    ruleCode: varchar({ length: 50 }).notNull(),
    /** 命中的连续签到阈值。 */
    streakDays: integer().notNull(),
    /** 连续奖励项快照。 */
    rewardItems: jsonb().notNull(),
    /** 是否允许重复发放。 */
    repeatable: boolean().default(false).notNull(),
    /** 触发本次连续奖励的签到日期。 */
    triggerSignDate: date().notNull(),
    /** 关联的奖励结算事实 ID。 */
    rewardSettlementId: integer(),
    /** 业务幂等键。 */
    bizKey: varchar({ length: 200 }).notNull(),
    /** 发放扩展上下文。 */
    context: jsonb(),
    /** 发放事实创建时间。 */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /** 发放事实最近更新时间。 */
    updatedAt: timestamp({ withTimezone: true, precision: 6 })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique('check_in_streak_grant_user_biz_key_key').on(
      table.userId,
      table.bizKey,
    ),
    index('check_in_streak_grant_round_config_id_idx').on(table.roundConfigId),
    index('check_in_streak_grant_user_id_trigger_sign_date_idx').on(
      table.userId,
      table.triggerSignDate,
    ),
    index('check_in_streak_grant_reward_settlement_id_idx').on(
      table.rewardSettlementId,
    ),
    index('check_in_streak_grant_rule_code_idx').on(table.ruleCode),
    index('check_in_streak_grant_trigger_sign_date_idx').on(
      table.triggerSignDate,
    ),
    check(
      'check_in_streak_grant_reward_settlement_id_positive_chk',
      sql`${table.rewardSettlementId} is null or ${table.rewardSettlementId} > 0`,
    ),
    check(
      'check_in_streak_grant_streak_days_positive_chk',
      sql`${table.streakDays} > 0`,
    ),
    check(
      'check_in_streak_grant_round_config_id_positive_chk',
      sql`${table.roundConfigId} > 0`,
    ),
    check(
      'check_in_streak_grant_round_iteration_positive_chk',
      sql`${table.roundIteration} > 0`,
    ),
  ],
)

export type CheckInStreakRewardGrant =
  typeof checkInStreakRewardGrant.$inferSelect
export type CheckInStreakRewardGrantSelect = CheckInStreakRewardGrant
export type CheckInStreakRewardGrantInsert =
  typeof checkInStreakRewardGrant.$inferInsert
