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
 * 内容导入预览条目表。
 * 存储压缩包和三方导入预览候选，替代旧 archive JSONB 预览结果。
 */
export const contentImportPreviewItem = snakeCase.table(
  'content_import_preview_item',
  {
    /** 主键 ID。 */
    id: bigint({ mode: 'bigint' }).primaryKey().generatedAlwaysAsIdentity(),
    /** 对外暴露的预览条目 ID。 */
    previewItemId: varchar({ length: 36 }).notNull(),
    /** 内容导入任务内部 ID。 */
    contentImportJobId: bigint({ mode: 'bigint' }).notNull(),
    /** 条目类型（1=漫画章节）。 */
    itemType: smallint().notNull(),
    /** 源文件或源路径。 */
    sourcePath: varchar({ length: 1000 }),
    /** 三方章节 ID。 */
    providerChapterId: varchar({ length: 100 }),
    /** 目标章节 ID。 */
    targetChapterId: integer(),
    /** 展示标题。 */
    title: varchar({ length: 200 }).notNull(),
    /** 排序值。 */
    sortOrder: integer().default(0).notNull(),
    /** 图片总数。 */
    imageTotal: integer().default(0).notNull(),
    /** 预览状态（1=匹配，2=忽略，3=警告）。 */
    status: smallint().notNull(),
    /** 忽略原因。 */
    ignoreReason: varchar({ length: 300 }),
    /** 警告信息。 */
    warningMessage: varchar({ length: 500 }),
    /** 预览元数据。 */
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
    unique('content_import_preview_item_preview_item_id_key').on(
      table.previewItemId,
    ),
    index('content_import_preview_item_job_status_sort_idx').on(
      table.contentImportJobId,
      table.status,
      table.sortOrder,
      table.id,
    ),
    check('content_import_preview_item_item_type_valid_chk', sql`${table.itemType} in (1)`),
    check('content_import_preview_item_status_valid_chk', sql`${table.status} in (1, 2, 3)`),
    check('content_import_preview_item_title_nonblank_chk', sql`length(trim(${table.title})) > 0`),
    check('content_import_preview_item_image_total_non_negative_chk', sql`${table.imageTotal} >= 0`),
  ],
)

export type ContentImportPreviewItemSelect =
  typeof contentImportPreviewItem.$inferSelect
export type ContentImportPreviewItemInsert =
  typeof contentImportPreviewItem.$inferInsert
