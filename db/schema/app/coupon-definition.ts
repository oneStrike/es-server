import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  smallint,
  snakeCase,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 券定义表。
 * 统一承载阅读券、折扣券、VIP 试用卡和补签卡定义。
 */
export const couponDefinition = snakeCase.table(
  'coupon_definition',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 券名称。 */
    name: varchar({ length: 80 }).notNull(),
    /** 券类型（1=阅读券；2=折扣券；3=VIP 试用卡；4=补签卡）。 */
    couponType: smallint().notNull(),
    /** 适用目标范围（1=章节；2=VIP；3=签到）。 */
    targetScope: smallint().notNull(),
    /** 折扣金额，单位为虚拟币或分。 */
    discountAmount: integer().default(0).notNull(),
    /** 折扣率基点，10000=不打折。 */
    discountRateBps: integer().default(10000).notNull(),
    /** 单张券可用次数。 */
    usageLimit: integer().default(1).notNull(),
    /** 有效天数；历史值 0 表示按实例过期时间控制。 */
    validDays: integer().default(7).notNull(),
    /** VIP 试用天数。 */
    benefitDays: integer().default(0).notNull(),
    /** 补签次数。 */
    benefitCount: integer().default(0).notNull(),
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
    index('coupon_definition_created_at_idx').on(table.createdAt.desc()),
    check(
      'coupon_definition_coupon_type_valid_chk',
      sql`${table.couponType} in (1, 2, 3, 4)`,
    ),
    check(
      'coupon_definition_target_scope_valid_chk',
      sql`${table.targetScope} in (1, 2, 3)`,
    ),
    check(
      'coupon_definition_discount_amount_non_negative_chk',
      sql`${table.discountAmount} >= 0`,
    ),
    check(
      'coupon_definition_discount_rate_range_chk',
      sql`${table.discountRateBps} >= 0 and ${table.discountRateBps} <= 10000`,
    ),
    check(
      'coupon_definition_usage_limit_positive_chk',
      sql`${table.usageLimit} >= 1`,
    ),
    check(
      'coupon_definition_valid_days_non_negative_chk',
      sql`${table.validDays} >= 0`,
    ),
    check(
      'coupon_definition_benefit_days_non_negative_chk',
      sql`${table.benefitDays} >= 0`,
    ),
    check(
      'coupon_definition_benefit_count_non_negative_chk',
      sql`${table.benefitCount} >= 0`,
    ),
    check(
      'coupon_definition_reading_ability_chk',
      sql`${table.couponType} != 1 or (${table.targetScope} = 1 and ${table.usageLimit} >= 1)`,
    ),
    check(
      'coupon_definition_discount_ability_chk',
      sql`${table.couponType} != 2 or (${table.targetScope} = 1 and (${table.discountAmount} > 0 or ${table.discountRateBps} < 10000))`,
    ),
    check(
      'coupon_definition_vip_trial_ability_chk',
      sql`${table.couponType} != 3 or (${table.targetScope} = 2 and ${table.benefitDays} >= 1)`,
    ),
    check(
      'coupon_definition_check_in_makeup_ability_chk',
      sql`${table.couponType} != 4 or (${table.targetScope} = 3 and ${table.benefitCount} >= 1)`,
    ),
  ],
)

export type CouponDefinitionSelect = typeof couponDefinition.$inferSelect
export type CouponDefinitionInsert = typeof couponDefinition.$inferInsert
