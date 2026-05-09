import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  smallint,
  snakeCase,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 虚拟币充值包表。
 * 支付成功后按套餐快照发放虚拟币资产。
 */
export const currencyPackage = snakeCase.table(
  'currency_package',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 充值包业务键。 */
    packageKey: varchar({ length: 64 }).notNull(),
    /** 充值包名称。 */
    name: varchar({ length: 80 }).notNull(),
    /** 支付价格，单位为分。 */
    price: integer().notNull(),
    /** 发放虚拟币数量。 */
    currencyAmount: integer().notNull(),
    /** 赠送虚拟币数量。 */
    bonusAmount: integer().default(0).notNull(),
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
    unique('currency_package_package_key_key').on(table.packageKey),
    index('currency_package_enabled_sort_order_idx').on(
      table.isEnabled,
      table.sortOrder,
    ),
    check('currency_package_price_non_negative_chk', sql`${table.price} >= 0`),
    check(
      'currency_package_currency_amount_positive_chk',
      sql`${table.currencyAmount} > 0`,
    ),
    check(
      'currency_package_bonus_amount_non_negative_chk',
      sql`${table.bonusAmount} >= 0`,
    ),
  ],
)

export type CurrencyPackageSelect = typeof currencyPackage.$inferSelect
export type CurrencyPackageInsert = typeof currencyPackage.$inferInsert
