import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  smallint,
  snakeCase,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * VIP 套餐表。
 * 由 admin 配置可售 VIP 套餐，订阅开通后写入用户订阅事实。
 */
export const membershipPlan = snakeCase.table(
  'membership_plan',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 套餐名称。 */
    name: varchar({ length: 80 }).notNull(),
    /** 套餐业务键，由服务端生成，供客户端和订单快照稳定引用。 */
    planKey: varchar({ length: 64 }).notNull(),
    /** 套餐层级（1=VIP；2=超级 VIP）。 */
    tier: smallint().default(1).notNull(),
    /** 套餐售价，单位为分。 */
    priceAmount: integer().notNull(),
    /** 划线原价，单位为分。 */
    originalPriceAmount: integer().default(0).notNull(),
    /** 有效天数。 */
    durationDays: integer().notNull(),
    /** 订阅页营销标签，空字符串表示不展示。 */
    displayTag: varchar({ length: 32 }).default('').notNull(),
    /** 开通后赠送积分数量，0=不赠送。 */
    bonusPointAmount: integer().default(0).notNull(),
    /** 是否支持自动续费签约。 */
    autoRenewEnabled: boolean().default(false).notNull(),
    /** 排序值，0=默认排序。 */
    sortOrder: smallint().default(0).notNull(),
    /** 是否启用。 */
    isEnabled: boolean().default(true).notNull(),
    /** 创建时间。 */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /** 更新时间。 */
    updatedAt: timestamp({ withTimezone: true, precision: 6 })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique('membership_plan_plan_key_key').on(table.planKey),
    index('membership_plan_enabled_sort_order_idx').on(
      table.isEnabled,
      table.tier,
      table.sortOrder,
    ),
    check('membership_plan_tier_valid_chk', sql`${table.tier} in (1, 2)`),
    check(
      'membership_plan_price_amount_non_negative_chk',
      sql`${table.priceAmount} >= 0`,
    ),
    check(
      'membership_plan_original_price_amount_valid_chk',
      sql`${table.originalPriceAmount} >= ${table.priceAmount}`,
    ),
    check(
      'membership_plan_duration_days_positive_chk',
      sql`${table.durationDays} > 0`,
    ),
    check(
      'membership_plan_bonus_point_amount_non_negative_chk',
      sql`${table.bonusPointAmount} >= 0`,
    ),
    check(
      'membership_plan_sort_order_non_negative_chk',
      sql`${table.sortOrder} >= 0`,
    ),
  ],
)

export type MembershipPlanSelect = typeof membershipPlan.$inferSelect
export type MembershipPlanInsert = typeof membershipPlan.$inferInsert
