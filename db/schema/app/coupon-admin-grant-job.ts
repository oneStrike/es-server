import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  snakeCase,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 后台批量发券工作流领域任务表。
 * 通过 workflowJobId 关联通用工作流任务，operationId 承载 admin 提交幂等契约。
 */
export const couponAdminGrantJob = snakeCase.table(
  'coupon_admin_grant_job',
  {
    /** 主键 ID，作为 user_coupon_instance.sourceId 使用。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 归属工作流任务内部 ID。 */
    workflowJobId: bigint({ mode: 'bigint' }).notNull(),
    /** 券定义 ID。 */
    couponDefinitionId: integer().notNull(),
    /** 后台提交幂等 ID。 */
    operationId: varchar({ length: 120 }).notNull(),
    /** operationId 的稳定哈希。 */
    operationHash: varchar({ length: 64 }).notNull(),
    /** 创建载荷的稳定哈希。 */
    payloadHash: varchar({ length: 64 }).notNull(),
    /** 后台管理员操作者 ID。 */
    operatorUserId: integer().notNull(),
    /** 每个用户发券数量。 */
    perUserQuantity: integer().notNull(),
    /** 选中用户数。 */
    selectedUserCount: integer().notNull(),
    /** 请求发券总数。 */
    requestedGrantCount: integer().notNull(),
    /** 后台备注。 */
    remark: varchar({ length: 500 }),
    /** 券定义发放快照。 */
    couponSnapshot: jsonb().notNull(),
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
    unique('coupon_admin_grant_job_workflow_job_id_key').on(
      table.workflowJobId,
    ),
    unique('coupon_admin_grant_job_operation_id_key').on(table.operationId),
    index('coupon_admin_grant_job_coupon_definition_created_at_idx').on(
      table.couponDefinitionId,
      table.createdAt.desc(),
    ),
    check(
      'coupon_admin_grant_job_operation_id_nonblank_chk',
      sql`length(trim(${table.operationId})) > 0`,
    ),
    check(
      'coupon_admin_grant_job_operation_hash_nonblank_chk',
      sql`length(trim(${table.operationHash})) > 0`,
    ),
    check(
      'coupon_admin_grant_job_payload_hash_nonblank_chk',
      sql`length(trim(${table.payloadHash})) > 0`,
    ),
    check(
      'coupon_admin_grant_job_per_user_quantity_positive_chk',
      sql`${table.perUserQuantity} > 0`,
    ),
    check(
      'coupon_admin_grant_job_selected_user_count_positive_chk',
      sql`${table.selectedUserCount} > 0`,
    ),
    check(
      'coupon_admin_grant_job_requested_grant_count_positive_chk',
      sql`${table.requestedGrantCount} > 0`,
    ),
  ],
)

export type CouponAdminGrantJobSelect = typeof couponAdminGrantJob.$inferSelect
export type CouponAdminGrantJobInsert = typeof couponAdminGrantJob.$inferInsert
