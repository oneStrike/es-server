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
 * 内容导入正式条目表。
 * 漫画场景以章节为原子导入与重试单位。
 */
export const contentImportItem = snakeCase.table(
  'content_import_item',
  {
    /** 主键 ID。 */
    id: bigint({ mode: 'bigint' }).primaryKey().generatedAlwaysAsIdentity(),
    /** 对外暴露的条目 ID。 */
    itemId: varchar({ length: 36 }).notNull(),
    /** 内容导入任务内部 ID。 */
    contentImportJobId: bigint({ mode: 'bigint' }).notNull(),
    /** 条目类型（1=漫画章节）。 */
    itemType: smallint().notNull(),
    /** 三方章节 ID。 */
    providerChapterId: varchar({ length: 100 }),
    /** 目标章节 ID。 */
    targetChapterId: integer(),
    /** 本地章节 ID。 */
    localChapterId: integer(),
    /** 展示标题。 */
    title: varchar({ length: 200 }).notNull(),
    /** 排序值。 */
    sortOrder: integer().default(0).notNull(),
    /** 条目状态（1=待处理，2=处理中，3=成功，4=失败，5=重试中，6=已跳过）。 */
    status: smallint().notNull(),
    /** 当前阶段（1=预览中，2=读取来源，3=准备元数据，4=读取内容，5=导入图片，6=写入内容，7=清理残留，8=已完成）。 */
    stage: smallint().notNull(),
    /** 失败次数。 */
    failureCount: integer().default(0).notNull(),
    /** 最近错误码。 */
    lastErrorCode: varchar({ length: 120 }),
    /** 最近错误信息。 */
    lastErrorMessage: varchar({ length: 500 }),
    /** 最近失败时间。 */
    lastFailedAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 图片总数。 */
    imageTotal: integer().default(0).notNull(),
    /** 图片成功数。 */
    imageSuccessCount: integer().default(0).notNull(),
    /** 当前 attempt 序号。 */
    currentAttemptNo: integer(),
    /** 条目元数据。 */
    metadata: jsonb(),
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
    unique('content_import_item_item_id_key').on(table.itemId),
    index('content_import_item_job_status_sort_idx').on(
      table.contentImportJobId,
      table.status,
      table.sortOrder,
      table.id,
    ),
    index('content_import_item_job_provider_chapter_idx').on(
      table.contentImportJobId,
      table.providerChapterId,
    ),
    index('content_import_item_job_local_chapter_idx').on(
      table.contentImportJobId,
      table.localChapterId,
    ),
    check('content_import_item_item_type_valid_chk', sql`${table.itemType} in (1)`),
    check('content_import_item_status_valid_chk', sql`${table.status} in (1, 2, 3, 4, 5, 6)`),
    check('content_import_item_stage_valid_chk', sql`${table.stage} in (1, 2, 3, 4, 5, 6, 7, 8)`),
    check('content_import_item_title_nonblank_chk', sql`length(trim(${table.title})) > 0`),
    check('content_import_item_failure_count_non_negative_chk', sql`${table.failureCount} >= 0`),
    check('content_import_item_image_total_non_negative_chk', sql`${table.imageTotal} >= 0`),
    check('content_import_item_image_success_count_non_negative_chk', sql`${table.imageSuccessCount} >= 0`),
    check('content_import_item_current_attempt_no_positive_chk', sql`${table.currentAttemptNo} is null or ${table.currentAttemptNo} > 0`),
  ],
)

export type ContentImportItemSelect = typeof contentImportItem.$inferSelect
export type ContentImportItemInsert = typeof contentImportItem.$inferInsert
