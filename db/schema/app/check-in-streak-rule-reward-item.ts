import { sql } from 'drizzle-orm'
import { check, index, integer, pgTable, smallint, varchar } from 'drizzle-orm/pg-core'

/**
 * 连续签到规则奖励项。
 *
 * 一条奖励项一条记录，按 `sortOrder` 保持展示顺序。
 */
export const checkInStreakRuleRewardItem = pgTable(
  'check_in_streak_rule_reward_item',
  {
    /** 奖励项主键。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 所属规则 ID。 */
    ruleId: integer().notNull(),
    /** 奖励资产类型（1=积分；2=经验）。 */
    assetType: smallint().notNull(),
    /** 奖励资产键。 */
    assetKey: varchar({ length: 50 }).default('').notNull(),
    /** 奖励数量。 */
    amount: integer().notNull(),
    /** 排序值。0=默认顺序。 */
    sortOrder: smallint().default(0).notNull(),
  },
  (table) => [
    index('check_in_streak_rule_reward_item_rule_id_idx').on(table.ruleId),
    check(
      'check_in_streak_rule_reward_item_rule_id_positive_chk',
      sql`${table.ruleId} > 0`,
    ),
    check(
      'check_in_streak_rule_reward_item_asset_type_valid_chk',
      sql`${table.assetType} in (1, 2)`,
    ),
    check(
      'check_in_streak_rule_reward_item_amount_positive_chk',
      sql`${table.amount} > 0`,
    ),
    check(
      'check_in_streak_rule_reward_item_sort_order_non_negative_chk',
      sql`${table.sortOrder} >= 0`,
    ),
  ],
)

export type CheckInStreakRuleRewardItem =
  typeof checkInStreakRuleRewardItem.$inferSelect
export type CheckInStreakRuleRewardItemSelect = CheckInStreakRuleRewardItem
export type CheckInStreakRuleRewardItemInsert =
  typeof checkInStreakRuleRewardItem.$inferInsert
