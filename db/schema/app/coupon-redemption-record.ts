import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  smallint,
  snakeCase,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 券核销记录表。
 * 券扣减和权益写入必须在同一事务中完成。
 */
export const couponRedemptionRecord = snakeCase.table(
  'coupon_redemption_record',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 用户 ID。 */
    userId: integer().notNull(),
    /** 券实例 ID。 */
    couponInstanceId: integer().notNull(),
    /** 券类型快照（1=阅读券；2=折扣券；3=VIP 试用卡；4=免广告卡；5=补签卡）。 */
    couponType: smallint().notNull(),
    /** 目标类型（1=漫画章节；2=小说章节；3=VIP；4=签到）。 */
    targetType: smallint().notNull(),
    /** 目标 ID。 */
    targetId: integer().notNull(),
    /** 核销状态（1=成功；2=失败；3=已撤销）。 */
    status: smallint().default(1).notNull(),
    /** 幂等业务键。 */
    bizKey: varchar({ length: 120 }).notNull(),
    /** 核销快照。 */
    redemptionSnapshot: jsonb(),
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
    unique('coupon_redemption_record_user_biz_key_key').on(
      table.userId,
      table.bizKey,
    ),
    index('coupon_redemption_record_instance_status_idx').on(
      table.couponInstanceId,
      table.status,
    ),
    index('coupon_redemption_record_target_idx').on(
      table.targetType,
      table.targetId,
    ),
    check(
      'coupon_redemption_record_coupon_type_valid_chk',
      sql`${table.couponType} in (1, 2, 3, 4, 5)`,
    ),
    check(
      'coupon_redemption_record_target_type_valid_chk',
      sql`${table.targetType} in (1, 2, 3, 4)`,
    ),
    check(
      'coupon_redemption_record_status_valid_chk',
      sql`${table.status} in (1, 2, 3)`,
    ),
  ],
)

export type CouponRedemptionRecordSelect =
  typeof couponRedemptionRecord.$inferSelect
export type CouponRedemptionRecordInsert =
  typeof couponRedemptionRecord.$inferInsert
