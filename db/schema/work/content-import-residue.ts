import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  index,
  jsonb,
  smallint,
  snakeCase,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 内容导入残留表。
 * 记录图片上传、压缩包解压目录、临时文件和补偿对象的清理状态。
 */
export const contentImportResidue = snakeCase.table(
  'content_import_residue',
  {
    /** 主键 ID。 */
    id: bigint({ mode: 'bigint' }).primaryKey().generatedAlwaysAsIdentity(),
    /** 对外暴露的残留 ID。 */
    residueId: varchar({ length: 36 }).notNull(),
    /** 工作流任务内部 ID。 */
    workflowJobId: bigint({ mode: 'bigint' }).notNull(),
    /** 工作流 attempt 内部 ID。 */
    workflowAttemptId: bigint({ mode: 'bigint' }),
    /** 内容导入条目内部 ID。 */
    contentImportItemId: bigint({ mode: 'bigint' }),
    /** 内容导入条目 attempt 内部 ID。 */
    contentImportItemAttemptId: bigint({ mode: 'bigint' }),
    /** 残留类型（1=已上传文件，2=压缩包文件，3=解压目录，4=已创建作品，5=已创建章节）。 */
    residueType: smallint().notNull(),
    /** 外部服务或存储提供方。 */
    provider: varchar({ length: 60 }),
    /** 远程文件路径。 */
    filePath: varchar({ length: 1000 }),
    /** 本地文件路径。 */
    localPath: varchar({ length: 1000 }),
    /** 残留元数据。 */
    metadata: jsonb(),
    /** 清理状态（1=待清理，2=已清理，3=清理失败，4=保留待重试）。 */
    cleanupStatus: smallint().notNull(),
    /** 清理错误信息。 */
    cleanupError: varchar({ length: 500 }),
    /** 创建时间。 */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /** 清理时间。 */
    cleanedAt: timestamp({ withTimezone: true, precision: 6 }),
  },
  (table) => [
    unique('content_import_residue_residue_id_key').on(table.residueId),
    index('content_import_residue_job_cleanup_status_idx').on(
      table.workflowJobId,
      table.cleanupStatus,
    ),
    index('content_import_residue_attempt_idx').on(table.workflowAttemptId),
    index('content_import_residue_item_idx').on(table.contentImportItemId),
    index('content_import_residue_item_attempt_idx').on(
      table.contentImportItemAttemptId,
    ),
    check(
      'content_import_residue_type_valid_chk',
      sql`${table.residueType} in (1, 2, 3, 4, 5)`,
    ),
    check(
      'content_import_residue_cleanup_status_valid_chk',
      sql`${table.cleanupStatus} in (1, 2, 3, 4)`,
    ),
  ],
)

export type ContentImportResidueSelect =
  typeof contentImportResidue.$inferSelect
export type ContentImportResidueInsert =
  typeof contentImportResidue.$inferInsert
