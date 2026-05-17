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
 * 内容导入工作流领域任务表。
 * 通过 workflowJobId 关联通用工作流任务，不重复存储公开 jobId。
 */
export const contentImportJob = snakeCase.table(
  'content_import_job',
  {
    /** 主键 ID。 */
    id: bigint({ mode: 'bigint' }).primaryKey().generatedAlwaysAsIdentity(),
    /** 归属工作流任务内部 ID。 */
    workflowJobId: bigint({ mode: 'bigint' }).notNull(),
    /** 内容类型（1=漫画）。 */
    contentType: smallint().notNull(),
    /** 来源类型（1=三方导入，2=三方同步，3=压缩包导入）。 */
    sourceType: smallint().notNull(),
    /** 本地作品 ID；新建作品导入前可为空。 */
    workId: integer(),
    /** 三方平台代码。 */
    platform: varchar({ length: 30 }),
    /** 三方漫画 ID。 */
    providerComicId: varchar({ length: 100 }),
    /** 三方漫画路径标识。 */
    providerPathWord: varchar({ length: 100 }),
    /** 三方章节分组路径标识。 */
    providerGroupPathWord: varchar({ length: 100 }),
    /** 原始压缩包文件名。 */
    archiveName: varchar({ length: 255 }),
    /** 原始压缩包本地存储路径。 */
    archivePath: varchar({ length: 1000 }),
    /** 解压目录本地路径。 */
    extractPath: varchar({ length: 1000 }),
    /** 预览模式（1=单章节，2=多章节）。 */
    previewMode: smallint(),
    /** 来源快照。 */
    sourceSnapshot: jsonb(),
    /** 发布边界状态（1=不变，2=需要人工复核）。 */
    publishBoundaryStatus: smallint().default(1).notNull(),
    /** 选中条目数。 */
    selectedItemCount: integer().default(0).notNull(),
    /** 成功条目数。 */
    successItemCount: integer().default(0).notNull(),
    /** 失败条目数。 */
    failedItemCount: integer().default(0).notNull(),
    /** 跳过条目数。 */
    skippedItemCount: integer().default(0).notNull(),
    /** 图片总数。 */
    imageTotal: integer().default(0).notNull(),
    /** 图片成功数。 */
    imageSuccessCount: integer().default(0).notNull(),
    /** 图片失败数。 */
    imageFailedCount: integer().default(0).notNull(),
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
    unique('content_import_job_workflow_job_id_key').on(table.workflowJobId),
    index('content_import_job_source_type_work_id_idx').on(
      table.sourceType,
      table.workId,
    ),
    index('content_import_job_platform_source_idx').on(
      table.platform,
      table.providerComicId,
      table.providerGroupPathWord,
    ),
    check('content_import_job_content_type_valid_chk', sql`${table.contentType} in (1)`),
    check('content_import_job_source_type_valid_chk', sql`${table.sourceType} in (1, 2, 3)`),
    check('content_import_job_preview_mode_valid_chk', sql`${table.previewMode} is null or ${table.previewMode} in (1, 2)`),
    check('content_import_job_publish_boundary_status_valid_chk', sql`${table.publishBoundaryStatus} in (1, 2)`),
    check('content_import_job_selected_item_count_non_negative_chk', sql`${table.selectedItemCount} >= 0`),
    check('content_import_job_success_item_count_non_negative_chk', sql`${table.successItemCount} >= 0`),
    check('content_import_job_failed_item_count_non_negative_chk', sql`${table.failedItemCount} >= 0`),
    check('content_import_job_skipped_item_count_non_negative_chk', sql`${table.skippedItemCount} >= 0`),
    check('content_import_job_image_total_non_negative_chk', sql`${table.imageTotal} >= 0`),
    check('content_import_job_image_success_count_non_negative_chk', sql`${table.imageSuccessCount} >= 0`),
    check('content_import_job_image_failed_count_non_negative_chk', sql`${table.imageFailedCount} >= 0`),
  ],
)

export type ContentImportJobSelect = typeof contentImportJob.$inferSelect
export type ContentImportJobInsert = typeof contentImportJob.$inferInsert
