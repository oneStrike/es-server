import { sql } from 'drizzle-orm'
import {
  bigint,
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
 * 通用工作流执行 attempt 表。
 * 每次初始确认、人工重试或系统恢复都会创建一个新的 attempt。
 */
export const workflowAttempt = snakeCase.table(
  'workflow_attempt',
  {
    /** 主键 ID。 */
    id: bigint({ mode: 'bigint' }).primaryKey().generatedAlwaysAsIdentity(),
    /** 对外暴露的 attempt ID。 */
    attemptId: varchar({ length: 36 }).notNull(),
    /** 归属工作流任务内部 ID。 */
    workflowJobId: bigint({ mode: 'bigint' }).notNull(),
    /** 同一任务内 attempt 序号。 */
    attemptNo: integer().notNull(),
    /** 触发类型（1=首次确认，2=人工重试，3=系统恢复）。 */
    triggerType: smallint().notNull(),
    /** 当前 attempt 状态（1=待处理，2=处理中，3=成功，4=部分失败，5=失败，6=已取消）。 */
    status: smallint().notNull(),
    /** 选中条目数。 */
    selectedItemCount: integer().default(0).notNull(),
    /** 成功条目数。 */
    successItemCount: integer().default(0).notNull(),
    /** 失败条目数。 */
    failedItemCount: integer().default(0).notNull(),
    /** 跳过条目数。 */
    skippedItemCount: integer().default(0).notNull(),
    /** 当前 claim 的 worker 标识。 */
    claimedBy: varchar({ length: 120 }),
    /** 当前 claim 过期时间。 */
    claimExpiresAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 最近心跳时间。 */
    heartbeatAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 错误码。 */
    errorCode: varchar({ length: 120 }),
    /** 错误信息。 */
    errorMessage: varchar({ length: 500 }),
    /** 开始处理时间。 */
    startedAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 完成时间。 */
    finishedAt: timestamp({ withTimezone: true, precision: 6 }),
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
    unique('workflow_attempt_attempt_id_key').on(table.attemptId),
    unique('workflow_attempt_job_attempt_no_key').on(
      table.workflowJobId,
      table.attemptNo,
    ),
    index('workflow_attempt_job_attempt_no_idx').on(
      table.workflowJobId,
      table.attemptNo,
    ),
    index('workflow_attempt_status_created_at_id_idx').on(
      table.status,
      table.createdAt,
      table.id,
    ),
    index('workflow_attempt_status_claim_expires_at_idx').on(
      table.status,
      table.claimExpiresAt,
    ),
    check('workflow_attempt_attempt_no_positive_chk', sql`${table.attemptNo} > 0`),
    check('workflow_attempt_trigger_type_valid_chk', sql`${table.triggerType} in (1, 2, 3)`),
    check('workflow_attempt_status_valid_chk', sql`${table.status} in (1, 2, 3, 4, 5, 6)`),
    check('workflow_attempt_selected_item_count_non_negative_chk', sql`${table.selectedItemCount} >= 0`),
    check('workflow_attempt_success_item_count_non_negative_chk', sql`${table.successItemCount} >= 0`),
    check('workflow_attempt_failed_item_count_non_negative_chk', sql`${table.failedItemCount} >= 0`),
    check('workflow_attempt_skipped_item_count_non_negative_chk', sql`${table.skippedItemCount} >= 0`),
  ],
)

export type WorkflowAttemptSelect = typeof workflowAttempt.$inferSelect
export type WorkflowAttemptInsert = typeof workflowAttempt.$inferInsert
