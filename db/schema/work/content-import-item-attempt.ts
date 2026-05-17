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
 * 内容导入条目 attempt 表。
 * 记录每个章节条目在每个工作流 attempt 中的执行结果。
 */
export const contentImportItemAttempt = snakeCase.table(
  'content_import_item_attempt',
  {
    /** 主键 ID。 */
    id: bigint({ mode: 'bigint' }).primaryKey().generatedAlwaysAsIdentity(),
    /** 对外暴露的条目 attempt ID。 */
    itemAttemptId: varchar({ length: 36 }).notNull(),
    /** 工作流 attempt 内部 ID。 */
    workflowAttemptId: bigint({ mode: 'bigint' }).notNull(),
    /** 内容导入条目内部 ID。 */
    contentImportItemId: bigint({ mode: 'bigint' }).notNull(),
    /** 工作流 attempt 序号。 */
    attemptNo: integer().notNull(),
    /** 条目 attempt 状态（1=待处理，2=处理中，3=成功，4=失败，5=已跳过）。 */
    status: smallint().notNull(),
    /** 当前阶段（1=预览中，2=读取来源，3=准备元数据，4=读取内容，5=导入图片，6=写入内容，7=清理残留，8=已完成）。 */
    stage: smallint().notNull(),
    /** 图片总数。 */
    imageTotal: integer().default(0).notNull(),
    /** 图片成功数。 */
    imageSuccessCount: integer().default(0).notNull(),
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
    unique('content_import_item_attempt_item_attempt_id_key').on(
      table.itemAttemptId,
    ),
    unique('content_import_item_attempt_item_attempt_no_key').on(
      table.contentImportItemId,
      table.attemptNo,
    ),
    index('content_import_item_attempt_workflow_attempt_status_idx').on(
      table.workflowAttemptId,
      table.status,
    ),
    index('content_import_item_attempt_item_id_idx').on(
      table.contentImportItemId,
    ),
    check('content_import_item_attempt_attempt_no_positive_chk', sql`${table.attemptNo} > 0`),
    check('content_import_item_attempt_status_valid_chk', sql`${table.status} in (1, 2, 3, 4, 5)`),
    check('content_import_item_attempt_stage_valid_chk', sql`${table.stage} in (1, 2, 3, 4, 5, 6, 7, 8)`),
    check('content_import_item_attempt_image_total_non_negative_chk', sql`${table.imageTotal} >= 0`),
    check('content_import_item_attempt_image_success_count_non_negative_chk', sql`${table.imageSuccessCount} >= 0`),
  ],
)

export type ContentImportItemAttemptSelect =
  typeof contentImportItemAttempt.$inferSelect
export type ContentImportItemAttemptInsert =
  typeof contentImportItemAttempt.$inferInsert
