import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  smallint,
  snakeCase,
  text,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 会员订阅页配置表。
 * 会员说明、自动续费提示和协议引用由服务端配置输出，避免客户端硬编码法务文案。
 */
export const membershipPageConfig = snakeCase.table(
  'membership_page_config',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 页面业务键，由服务端生成。 */
    pageKey: varchar({ length: 80 }).notNull(),
    /** 页面标题。 */
    title: varchar({ length: 80 }).notNull(),
    /** 会员说明条目。 */
    memberNoticeItems: jsonb(),
    /** 自动续费提示。 */
    autoRenewNotice: text().default('').notNull(),
    /** 确认开通协议提示文案。 */
    checkoutAgreementText: text().default('').notNull(),
    /** 支付按钮文案模板。 */
    submitButtonTemplate: varchar({ length: 120 }).default('').notNull(),
    /** 是否启用。 */
    isEnabled: boolean().default(true).notNull(),
    /** 排序值，0=默认排序。 */
    sortOrder: smallint().default(0).notNull(),
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
    unique('membership_page_config_page_key_key').on(table.pageKey),
    index('membership_page_config_enabled_sort_order_idx').on(
      table.isEnabled,
      table.sortOrder,
    ),
    check(
      'membership_page_config_sort_order_non_negative_chk',
      sql`${table.sortOrder} >= 0`,
    ),
  ],
)

export type MembershipPageConfigSelect =
  typeof membershipPageConfig.$inferSelect
export type MembershipPageConfigInsert =
  typeof membershipPageConfig.$inferInsert
