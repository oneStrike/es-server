import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  pgTable,
  smallint,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 连续签到奖励发放快照奖励项。
 *
 * 一条 grant 下的每个奖励项单独持久化，避免继续使用 JSON snapshot。
 */
export const checkInStreakGrantRewardItem = pgTable(
  'check_in_streak_grant_reward_item',
  {
    /** 奖励项主键。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 所属发放记录 ID。 */
    grantId: integer().notNull(),
    /** 奖励资产类型（1=积分；2=经验）。 */
    assetType: smallint().notNull(),
    /** 奖励资产键。 */
    assetKey: varchar({ length: 50 }).default('').notNull(),
    /** 奖励数量。 */
    amount: integer().notNull(),
    /** 连续奖励项图标 URL。 */
    iconUrl: varchar({ length: 500 }),
    /** 排序值。0=默认顺序。 */
    sortOrder: smallint().default(0).notNull(),
  },
  (table) => [
    index('check_in_streak_grant_reward_item_grant_id_idx').on(table.grantId),
    check(
      'check_in_streak_grant_reward_item_grant_id_positive_chk',
      sql`${table.grantId} > 0`,
    ),
    check(
      'check_in_streak_grant_reward_item_asset_type_valid_chk',
      sql`${table.assetType} in (1, 2)`,
    ),
    check(
      'check_in_streak_grant_reward_item_amount_positive_chk',
      sql`${table.amount} > 0`,
    ),
    index('check_in_streak_grant_reward_item_icon_url_idx').on(table.iconUrl),
    check(
      'check_in_streak_grant_reward_item_sort_order_non_negative_chk',
      sql`${table.sortOrder} >= 0`,
    ),
  ],
)

export type CheckInStreakGrantRewardItemSelect =
  typeof checkInStreakGrantRewardItem.$inferSelect
export type CheckInStreakGrantRewardItemInsert =
  typeof checkInStreakGrantRewardItem.$inferInsert
