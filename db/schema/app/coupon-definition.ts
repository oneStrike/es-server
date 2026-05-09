import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  smallint,
  snakeCase,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 券定义表。
 * 统一承载阅读券、折扣券、VIP 试用卡、免广告卡和补签卡定义。
 */
export const couponDefinition = snakeCase.table(
  'coupon_definition',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 券名称。 */
    name: varchar({ length: 80 }).notNull(),
    /** 券类型（1=阅读券；2=折扣券；3=VIP 试用卡；4=免广告卡；5=补签卡）。 */
    couponType: smallint().notNull(),
    /** 适用目标范围（1=章节；2=VIP；3=广告；4=签到）。 */
    targetScope: smallint().notNull(),
    /** 折扣金额，单位为虚拟币或分。 */
    discountAmount: integer().default(0).notNull(),
    /** 折扣率基点，10000=不打折。 */
    discountRateBps: integer().default(10000).notNull(),
    /** 单张券可用次数。 */
    usageLimit: integer().default(1).notNull(),
    /** 有效天数，0=按实例过期时间控制。 */
    validDays: integer().default(0).notNull(),
    /** 预算上限，0=不限制。 */
    budgetLimit: integer().default(0).notNull(),
    /** 额外配置快照。 */
    configPayload: jsonb(),
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
    index('coupon_definition_type_enabled_idx').on(
      table.couponType,
      table.isEnabled,
    ),
    check(
      'coupon_definition_coupon_type_valid_chk',
      sql`${table.couponType} in (1, 2, 3, 4, 5)`,
    ),
    check(
      'coupon_definition_target_scope_valid_chk',
      sql`${table.targetScope} in (1, 2, 3, 4)`,
    ),
    check(
      'coupon_definition_discount_amount_non_negative_chk',
      sql`${table.discountAmount} >= 0`,
    ),
    check(
      'coupon_definition_discount_rate_range_chk',
      sql`${table.discountRateBps} >= 0 and ${table.discountRateBps} <= 10000`,
    ),
  ],
)

export type CouponDefinitionSelect = typeof couponDefinition.$inferSelect
export type CouponDefinitionInsert = typeof couponDefinition.$inferInsert
