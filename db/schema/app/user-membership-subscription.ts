import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  smallint,
  snakeCase,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/**
 * 用户 VIP 订阅事实表。
 * VIP 权限只读取有效订阅事实，不再读取用户等级。
 */
export const userMembershipSubscription = snakeCase.table(
  'user_membership_subscription',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 用户 ID。 */
    userId: integer().notNull(),
    /** VIP 套餐 ID，可为空表示试用卡或补偿订阅。 */
    planId: integer(),
    /** 来源类型（1=支付订单；2=VIP 试用卡；3=后台补偿）。 */
    sourceType: smallint().notNull(),
    /** 来源 ID，例如订单 ID、券实例 ID 或后台补偿记录 ID。 */
    sourceId: integer(),
    /** 订阅状态（1=有效；2=已取消；3=已退款；4=已过期）。 */
    status: smallint().default(1).notNull(),
    /** 订阅开始时间。 */
    startsAt: timestamp({ withTimezone: true, precision: 6 }).notNull(),
    /** 订阅结束时间。 */
    endsAt: timestamp({ withTimezone: true, precision: 6 }).notNull(),
    /** 取消时间。 */
    cancelledAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 退款时间。 */
    refundedAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 来源快照，记录开通时的套餐、券或补偿上下文。 */
    sourceSnapshot: jsonb(),
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
    index('user_membership_subscription_user_status_ends_at_idx').on(
      table.userId,
      table.status,
      table.endsAt,
    ),
    index('user_membership_subscription_source_idx').on(
      table.sourceType,
      table.sourceId,
    ),
    uniqueIndex('user_membership_subscription_payment_order_source_key')
      .on(table.sourceType, table.sourceId)
      .where(sql`${table.sourceType} = 1 AND ${table.sourceId} IS NOT NULL`),
    uniqueIndex('user_membership_subscription_vip_trial_coupon_source_key')
      .on(table.sourceType, table.sourceId)
      .where(sql`${table.sourceType} = 2 AND ${table.sourceId} IS NOT NULL`),
    check(
      'user_membership_subscription_source_type_valid_chk',
      sql`${table.sourceType} in (1, 2, 3)`,
    ),
    check(
      'user_membership_subscription_status_valid_chk',
      sql`${table.status} in (1, 2, 3, 4)`,
    ),
    check(
      'user_membership_subscription_time_range_chk',
      sql`${table.endsAt} > ${table.startsAt}`,
    ),
  ],
)

export type UserMembershipSubscriptionSelect =
  typeof userMembershipSubscription.$inferSelect
export type UserMembershipSubscriptionInsert =
  typeof userMembershipSubscription.$inferInsert
