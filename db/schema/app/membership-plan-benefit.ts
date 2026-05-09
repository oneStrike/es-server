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
  unique,
} from 'drizzle-orm/pg-core'

/**
 * 会员套餐权益关联表。
 * 约束套餐内权益展示、开通发放、每日领取和订阅期持续生效规则。
 */
export const membershipPlanBenefit = snakeCase.table(
  'membership_plan_benefit',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** VIP 套餐 ID。 */
    planId: integer().notNull(),
    /** 会员权益定义 ID。 */
    benefitId: integer().notNull(),
    /** 发放策略（1=仅展示；2=开通时自动发放；3=每日可领取；4=订阅期内持续生效；5=手动领取一次）。 */
    grantPolicy: smallint().notNull(),
    /** 权益配置值，结构由 benefitType 与 grantPolicy 共同约束。 */
    benefitValue: jsonb(),
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
    unique('membership_plan_benefit_plan_benefit_key').on(
      table.planId,
      table.benefitId,
    ),
    index('membership_plan_benefit_plan_enabled_sort_order_idx').on(
      table.planId,
      table.isEnabled,
      table.sortOrder,
    ),
    check(
      'membership_plan_benefit_grant_policy_valid_chk',
      sql`${table.grantPolicy} in (1, 2, 3, 4, 5)`,
    ),
    check(
      'membership_plan_benefit_sort_order_non_negative_chk',
      sql`${table.sortOrder} >= 0`,
    ),
  ],
)

export type MembershipPlanBenefitSelect =
  typeof membershipPlanBenefit.$inferSelect
export type MembershipPlanBenefitInsert =
  typeof membershipPlanBenefit.$inferInsert
