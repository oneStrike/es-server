import { sql } from 'drizzle-orm'
import {
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
 * 用户资产余额表。
 *
 * 作为积分、经验、道具、虚拟货币、等级等可计量资产的统一热余额来源。
 */
export const userAssetBalance = snakeCase.table(
  'user_asset_balance',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 用户 ID。 */
    userId: integer().notNull(),
    /** 资产类型（1=积分；2=经验；3=道具；4=虚拟货币；5=等级）。 */
    assetType: smallint().notNull(),
    /**
     * 资产键。
     * 积分/经验等无需附加主键的资产固定为空字符串；扩展资产使用稳定业务键。
     */
    assetKey: varchar({ length: 64 }).default('').notNull(),
    /** 当前余额。 */
    balance: integer().default(0).notNull(),
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
    unique('user_asset_balance_user_id_asset_type_asset_key_key').on(
      table.userId,
      table.assetType,
      table.assetKey,
    ),
    index('user_asset_balance_user_id_asset_type_idx').on(
      table.userId,
      table.assetType,
    ),
    check(
      'user_asset_balance_asset_type_valid_chk',
      sql`${table.assetType} in (1, 2, 3, 4, 5)`,
    ),
    check(
      'user_asset_balance_asset_key_not_blank_chk',
      sql`(
      (${table.assetType} in (1, 2) and btrim(${table.assetKey}) = '')
      or (${table.assetType} in (3, 4, 5) and btrim(${table.assetKey}) <> '')
    )`,
    ),
    check(
      'user_asset_balance_balance_non_negative_chk',
      sql`${table.balance} >= 0`,
    ),
  ],
)

export type UserAssetBalanceSelect = typeof userAssetBalance.$inferSelect
export type UserAssetBalanceInsert = typeof userAssetBalance.$inferInsert
