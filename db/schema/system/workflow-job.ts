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
 * 通用工作流任务表。
 * 只承载跨业务的任务生命周期、操作者、进度和当前 attempt 指针。
 */
export const workflowJob = snakeCase.table(
  'workflow_job',
  {
    /** 主键 ID。 */
    id: bigint({ mode: 'bigint' }).primaryKey().generatedAlwaysAsIdentity(),
    /** 对外暴露的工作流任务 ID。 */
    jobId: varchar({ length: 36 }).notNull(),
    /** 工作流类型。 */
    workflowType: varchar({ length: 120 }).notNull(),
    /** 面向运营展示的任务名称。 */
    displayName: varchar({ length: 180 }).notNull(),
    /** 操作者类型（1=后台管理员，2=系统）。 */
    operatorType: smallint().notNull(),
    /** 后台管理员操作者 ID；系统任务为空。 */
    operatorUserId: integer(),
    /** 当前任务状态（1=草稿，2=待处理，3=处理中，4=成功，5=部分失败，6=失败，7=已取消，8=已过期）。 */
    status: smallint().notNull(),
    /** 进度百分比。 */
    progressPercent: integer().default(0).notNull(),
    /** 进度文案。 */
    progressMessage: varchar({ length: 300 }),
    /** 当前 attempt 内部 ID。 */
    currentAttemptFk: bigint({ mode: 'bigint' }),
    /** 选中条目数。 */
    selectedItemCount: integer().default(0).notNull(),
    /** 成功条目数。 */
    successItemCount: integer().default(0).notNull(),
    /** 失败条目数。 */
    failedItemCount: integer().default(0).notNull(),
    /** 跳过条目数。 */
    skippedItemCount: integer().default(0).notNull(),
    /** 取消请求时间。 */
    cancelRequestedAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 开始处理时间。 */
    startedAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 完成时间。 */
    finishedAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 草稿过期时间。 */
    expiresAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 运行时非查询诊断摘要。 */
    summary: jsonb(),
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
    unique('workflow_job_job_id_key').on(table.jobId),
    index('workflow_job_workflow_type_status_updated_at_id_idx').on(
      table.workflowType,
      table.status,
      table.updatedAt.desc(),
      table.id.desc(),
    ),
    index('workflow_job_status_updated_at_id_idx').on(
      table.status,
      table.updatedAt.desc(),
      table.id.desc(),
    ),
    index('workflow_job_operator_updated_at_id_idx').on(
      table.operatorType,
      table.operatorUserId,
      table.updatedAt.desc(),
      table.id.desc(),
    ),
    index('workflow_job_status_created_at_id_idx').on(
      table.status,
      table.createdAt,
      table.id,
    ),
    check('workflow_job_workflow_type_nonblank_chk', sql`length(trim(${table.workflowType})) > 0`),
    check('workflow_job_display_name_nonblank_chk', sql`length(trim(${table.displayName})) > 0`),
    check('workflow_job_operator_type_valid_chk', sql`${table.operatorType} in (1, 2)`),
    check(
      'workflow_job_operator_user_id_scope_chk',
      sql`(${table.operatorType} = 1 and ${table.operatorUserId} is not null) or (${table.operatorType} = 2 and ${table.operatorUserId} is null)`,
    ),
    check('workflow_job_status_valid_chk', sql`${table.status} in (1, 2, 3, 4, 5, 6, 7, 8)`),
    check('workflow_job_progress_percent_range_chk', sql`${table.progressPercent} between 0 and 100`),
    check('workflow_job_selected_item_count_non_negative_chk', sql`${table.selectedItemCount} >= 0`),
    check('workflow_job_success_item_count_non_negative_chk', sql`${table.successItemCount} >= 0`),
    check('workflow_job_failed_item_count_non_negative_chk', sql`${table.failedItemCount} >= 0`),
    check('workflow_job_skipped_item_count_non_negative_chk', sql`${table.skippedItemCount} >= 0`),
  ],
)

export type WorkflowJobSelect = typeof workflowJob.$inferSelect
export type WorkflowJobInsert = typeof workflowJob.$inferInsert
