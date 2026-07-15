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
 * 补签额度事实账本。
 *
 * 统一记录补签额度的发放、消费和过期，作为补签额度的唯一事实来源。
 */
export const checkInMakeupFact = snakeCase.table(
  'check_in_makeup_fact',
  {
    /** 补签事实主键。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 归属用户 ID。 */
    userId: integer().notNull(),
    /** 事实类型（1=发放，2=消费，3=过期）。 */
    factType: smallint().notNull(),
    /** 来源类型（1=周期额度，2=活动补签卡，3=管理员调整）。 */
    sourceType: smallint().notNull(),
    /** 本次发放额度。 */
    amount: integer().default(0).notNull(),
    /** 本次消费额度。 */
    consumedAmount: integer().default(0).notNull(),
    /** 生效时间。 */
    effectiveAt: timestamp({ withTimezone: true, precision: 6 }).notNull(),
    /** 失效时间。 */
    expiresAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 周期类型（1=按自然周，2=按自然月）。 */
    periodType: smallint(),
    /** 周期键。 */
    periodKey: varchar({ length: 32 }),
    /** 关联业务来源。 */
    sourceRef: varchar({ length: 64 }),
    /** 幂等业务键。 */
    bizKey: varchar({ length: 180 }).notNull(),
    /** 扩展上下文。 */
    context: jsonb(),
    /** 创建时间。 */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('check_in_makeup_fact_user_biz_key_key').on(
      table.userId,
      table.bizKey,
    ),
    index('check_in_makeup_fact_user_id_created_at_idx').on(
      table.userId,
      table.createdAt,
    ),
    index('check_in_makeup_fact_user_period_idx').on(
      table.userId,
      table.periodType,
      table.periodKey,
    ),
    check(
      'check_in_makeup_fact_type_valid_chk',
      sql`${table.factType} in (1, 2, 3)`,
    ),
    check(
      'check_in_makeup_fact_source_type_valid_chk',
      sql`${table.sourceType} in (1, 2, 3)`,
    ),
    check(
      'check_in_makeup_fact_period_type_valid_chk',
      sql`${table.periodType} is null or ${table.periodType} in (1, 2)`,
    ),
    check(
      'check_in_makeup_fact_amount_non_negative_chk',
      sql`${table.amount} >= 0`,
    ),
    check(
      'check_in_makeup_fact_consumed_amount_non_negative_chk',
      sql`${table.consumedAmount} >= 0`,
    ),
    check(
      'check_in_makeup_fact_biz_key_not_blank_chk',
      sql`btrim(${table.bizKey}) <> ''`,
    ),
    check(
      'check_in_makeup_fact_source_ref_not_blank_chk',
      sql`${table.sourceRef} is null or btrim(${table.sourceRef}) <> ''`,
    ),
  ],
)

export type CheckInMakeupFactSelect = typeof checkInMakeupFact.$inferSelect
export type CheckInMakeupFactInsert = typeof checkInMakeupFact.$inferInsert
