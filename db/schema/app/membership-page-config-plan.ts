import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  primaryKey,
  smallint,
  snakeCase,
} from 'drizzle-orm/pg-core'

/**
 * 会员订阅页套餐关联表。
 * 订阅页通过显式绑定套餐决定展示和下单范围，支持 VIP、超级 VIP 单独配置或混合配置。
 */
export const membershipPageConfigPlan = snakeCase.table(
  'membership_page_config_plan',
  {
    /** 会员订阅页配置 ID。 */
    pageConfigId: integer().notNull(),
    /** VIP 套餐 ID。 */
    planId: integer().notNull(),
    /** 排序值，0=默认排序。 */
    sortOrder: smallint().default(0).notNull(),
  },
  (table) => [
    index('membership_page_config_plan_page_sort_idx').on(
      table.pageConfigId,
      table.sortOrder,
    ),
    index('membership_page_config_plan_plan_id_idx').on(table.planId),
    check(
      'membership_page_config_plan_sort_order_non_negative_chk',
      sql`${table.sortOrder} >= 0`,
    ),
    primaryKey({ columns: [table.pageConfigId, table.planId] }),
  ],
)

export type MembershipPageConfigPlanSelect =
  typeof membershipPageConfigPlan.$inferSelect
export type MembershipPageConfigPlanInsert =
  typeof membershipPageConfigPlan.$inferInsert
