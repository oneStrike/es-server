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
 * 会员订阅页协议关联表。
 * 协议类型不在 VIP 模块建模，由 admin 直接选择 app_agreement 中的已发布协议。
 */
export const membershipPageConfigAgreement = snakeCase.table(
  'membership_page_config_agreement',
  {
    /** 会员订阅页配置 ID。 */
    pageConfigId: integer().notNull(),
    /** 应用协议 ID。 */
    agreementId: integer().notNull(),
    /** 排序值，0=默认排序。 */
    sortOrder: smallint().default(0).notNull(),
  },
  (table) => [
    index('membership_page_config_agreement_page_sort_idx').on(
      table.pageConfigId,
      table.sortOrder,
    ),
    index('membership_page_config_agreement_agreement_id_idx').on(
      table.agreementId,
    ),
    check(
      'membership_page_config_agreement_sort_order_non_negative_chk',
      sql`${table.sortOrder} >= 0`,
    ),
    primaryKey({ columns: [table.pageConfigId, table.agreementId] }),
  ],
)

export type MembershipPageConfigAgreementSelect =
  typeof membershipPageConfigAgreement.$inferSelect
export type MembershipPageConfigAgreementInsert =
  typeof membershipPageConfigAgreement.$inferInsert
