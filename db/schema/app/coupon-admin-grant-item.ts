import { sql } from 'drizzle-orm'
import {
  bigint,
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
 * 后台批量发券工作流用户条目表。
 * 每个选中用户一行，worker 以条目为重试、取消和观测原子单位。
 */
export const couponAdminGrantItem = snakeCase.table(
  'coupon_admin_grant_item',
  {
    /** 主键 ID。 */
    id: bigint({ mode: 'bigint' }).primaryKey().generatedAlwaysAsIdentity(),
    /** 对外暴露的条目 ID。 */
    itemId: varchar({ length: 36 }).notNull(),
    /** 批量发券任务内部 ID。 */
    couponAdminGrantJobId: integer().notNull(),
    /** APP 用户 ID。 */
    userId: integer().notNull(),
    /** 条目状态（1=待处理，2=处理中，3=成功，4=失败，5=重试中，6=已跳过）。 */
    status: smallint().notNull(),
    /** 应发券数量。 */
    grantCount: integer().notNull(),
    /** 本条目实际新建券实例数量；幂等命中时可小于 grantCount。 */
    createdCount: integer().default(0).notNull(),
    /** 当前 attempt 序号。 */
    currentAttemptNo: integer(),
    /** 失败次数。 */
    failureCount: integer().default(0).notNull(),
    /** 最近错误事实。 */
    lastError: jsonb(),
    /** 最近失败时间。 */
    lastFailedAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 下次可重试时间。 */
    nextRetryAt: timestamp({ withTimezone: true, precision: 6 }),
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
    unique('coupon_admin_grant_item_item_id_key').on(table.itemId),
    unique('coupon_admin_grant_item_job_user_key').on(
      table.couponAdminGrantJobId,
      table.userId,
    ),
    index('coupon_admin_grant_item_job_status_updated_id_idx').on(
      table.couponAdminGrantJobId,
      table.status,
      table.updatedAt,
      table.id,
    ),
    index('coupon_admin_grant_item_user_created_at_idx').on(
      table.userId,
      table.createdAt.desc(),
    ),
    check(
      'coupon_admin_grant_item_status_valid_chk',
      sql`${table.status} in (1, 2, 3, 4, 5, 6)`,
    ),
    check(
      'coupon_admin_grant_item_grant_count_positive_chk',
      sql`${table.grantCount} > 0`,
    ),
    check(
      'coupon_admin_grant_item_created_count_non_negative_chk',
      sql`${table.createdCount} >= 0`,
    ),
    check(
      'coupon_admin_grant_item_failure_count_non_negative_chk',
      sql`${table.failureCount} >= 0`,
    ),
    check(
      'coupon_admin_grant_item_current_attempt_no_positive_chk',
      sql`${table.currentAttemptNo} is null or ${table.currentAttemptNo} > 0`,
    ),
  ],
)

export type CouponAdminGrantItemSelect =
  typeof couponAdminGrantItem.$inferSelect
export type CouponAdminGrantItemInsert =
  typeof couponAdminGrantItem.$inferInsert
