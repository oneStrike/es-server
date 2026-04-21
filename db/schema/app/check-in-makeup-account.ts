import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  pgTable,
  smallint,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 补签额度账户。
 *
 * 作为补签资格判断和高频读取的唯一 owner，按当前周期 bucket 保存系统额度，
 * 并与活动补签卡余额同表维护。
 */
export const checkInMakeupAccount = pgTable(
  'check_in_makeup_account',
  {
    /** 补签账户主键。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 归属用户 ID。 */
    userId: integer().notNull(),
    /** 当前周期类型（1=按自然周，2=按自然月）。 */
    periodType: smallint().notNull(),
    /** 当前周期键。 */
    periodKey: varchar({ length: 32 }).notNull(),
    /** 当前周期系统发放额度。 */
    periodicGranted: integer().default(0).notNull(),
    /** 当前周期已消费系统额度。 */
    periodicUsed: integer().default(0).notNull(),
    /** 当前活动补签卡可用额度。 */
    eventAvailable: integer().default(0).notNull(),
    /** 乐观锁版本。 */
    version: integer().default(0).notNull(),
    /** 最近同步的事实 ID。 */
    lastSyncedFactId: integer(),
    /** 账户创建时间。 */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /** 账户更新时间。 */
    updatedAt: timestamp({ withTimezone: true, precision: 6 })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique('check_in_makeup_account_user_period_key_key').on(
      table.userId,
      table.periodType,
      table.periodKey,
    ),
    index('check_in_makeup_account_user_id_idx').on(table.userId),
    check(
      'check_in_makeup_account_period_type_valid_chk',
      sql`${table.periodType} in (1, 2)`,
    ),
    check(
      'check_in_makeup_account_period_key_not_blank_chk',
      sql`btrim(${table.periodKey}) <> ''`,
    ),
    check(
      'check_in_makeup_account_periodic_granted_non_negative_chk',
      sql`${table.periodicGranted} >= 0`,
    ),
    check(
      'check_in_makeup_account_periodic_used_non_negative_chk',
      sql`${table.periodicUsed} >= 0`,
    ),
    check(
      'check_in_makeup_account_event_available_non_negative_chk',
      sql`${table.eventAvailable} >= 0`,
    ),
    check(
      'check_in_makeup_account_periodic_used_not_gt_granted_chk',
      sql`${table.periodicUsed} <= ${table.periodicGranted}`,
    ),
    check(
      'check_in_makeup_account_version_non_negative_chk',
      sql`${table.version} >= 0`,
    ),
  ],
)

export type CheckInMakeupAccountSelect =
  typeof checkInMakeupAccount.$inferSelect
export type CheckInMakeupAccountInsert =
  typeof checkInMakeupAccount.$inferInsert
