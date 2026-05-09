import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  smallint,
  snakeCase,
  timestamp,
} from 'drizzle-orm/pg-core'

/**
 * 用户券实例表。
 * 发放到用户后的券以实例为准核销，支持次数、过期和撤销。
 */
export const userCouponInstance = snakeCase.table(
  'user_coupon_instance',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 用户 ID。 */
    userId: integer().notNull(),
    /** 券定义 ID。 */
    couponDefinitionId: integer().notNull(),
    /** 券类型快照（1=阅读券；2=折扣券；3=VIP 试用卡；4=免广告卡；5=补签卡）。 */
    couponType: smallint().notNull(),
    /** 状态（1=可用；2=已用完；3=已过期；4=已撤销）。 */
    status: smallint().default(1).notNull(),
    /** 剩余可用次数。 */
    remainingUses: integer().notNull(),
    /** 来源类型（1=任务；2=积分兑换；3=后台发放；4=购买补偿）。 */
    sourceType: smallint().notNull(),
    /** 来源 ID。 */
    sourceId: integer(),
    /** 过期时间。 */
    expiresAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 发放快照。 */
    grantSnapshot: jsonb(),
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
    index('user_coupon_instance_user_status_expires_at_idx').on(
      table.userId,
      table.status,
      table.expiresAt,
    ),
    index('user_coupon_instance_source_idx').on(
      table.sourceType,
      table.sourceId,
    ),
    check(
      'user_coupon_instance_coupon_type_valid_chk',
      sql`${table.couponType} in (1, 2, 3, 4, 5)`,
    ),
    check(
      'user_coupon_instance_status_valid_chk',
      sql`${table.status} in (1, 2, 3, 4)`,
    ),
    check(
      'user_coupon_instance_source_type_valid_chk',
      sql`${table.sourceType} in (1, 2, 3, 4)`,
    ),
    check(
      'user_coupon_instance_remaining_uses_non_negative_chk',
      sql`${table.remainingUses} >= 0`,
    ),
  ],
)

export type UserCouponInstanceSelect = typeof userCouponInstance.$inferSelect
export type UserCouponInstanceInsert = typeof userCouponInstance.$inferInsert
