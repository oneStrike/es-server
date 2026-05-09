import { sql } from 'drizzle-orm'
import {
  check,
  date,
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
 * 会员权益领取记录表。
 * 每日礼包和手动领取权益通过 bizKey 保证幂等，已发放事实不因权益下架而删除。
 */
export const membershipBenefitClaimRecord = snakeCase.table(
  'membership_benefit_claim_record',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 用户 ID。 */
    userId: integer().notNull(),
    /** VIP 套餐 ID。 */
    planId: integer().notNull(),
    /** 会员权益定义 ID。 */
    benefitId: integer().notNull(),
    /** 订阅事实 ID。 */
    subscriptionId: integer().notNull(),
    /** 领取日期，用于每日领取幂等。 */
    claimDate: date({ mode: 'date' }).notNull(),
    /** 发放目标类型，开放值，由权益类型解释。 */
    grantTargetType: smallint(),
    /** 发放目标 ID。 */
    grantTargetId: integer(),
    /** 业务幂等键。 */
    bizKey: varchar({ length: 160 }).notNull(),
    /** 领取状态（1=成功；2=失败；3=已撤销）。 */
    status: smallint().default(1).notNull(),
    /** 发放快照，记录券、道具或权益事实上下文。 */
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
    unique('membership_benefit_claim_record_biz_key_key').on(table.bizKey),
    index('membership_benefit_claim_record_user_benefit_date_idx').on(
      table.userId,
      table.benefitId,
      table.claimDate,
    ),
    check(
      'membership_benefit_claim_record_status_valid_chk',
      sql`${table.status} in (1, 2, 3)`,
    ),
  ],
)

export type MembershipBenefitClaimRecordSelect =
  typeof membershipBenefitClaimRecord.$inferSelect
export type MembershipBenefitClaimRecordInsert =
  typeof membershipBenefitClaimRecord.$inferInsert
