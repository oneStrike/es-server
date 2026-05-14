import { sql } from 'drizzle-orm'
import {
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
 * 漫画压缩包预解析会话表。
 * 在压缩包上传前先注册可取消会话，确保关闭弹窗时可以强一致清理预确认残留。
 */
export const workComicArchiveImportPreviewSession = snakeCase.table(
  'work_comic_archive_import_preview_session',
  {
    /**
     * 主键ID。
     */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 对外暴露的任务ID。
     */
    taskId: varchar({ length: 36 }).notNull(),
    /**
     * 关联作品ID。
     */
    workId: integer().notNull(),
    /**
     * 单章节导入目标章节ID。
     */
    chapterId: integer(),
    /**
     * 预解析会话状态（1=开放，2=丢弃中）。
     */
    status: smallint().notNull(),
    /**
     * 会话过期时间。
     */
    expiresAt: timestamp({ withTimezone: true, precision: 6 }).notNull(),
    /**
     * 创建时间。
     */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /**
     * 更新时间。
     */
    updatedAt: timestamp({ withTimezone: true, precision: 6 })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    /**
     * 任务ID唯一约束。
     */
    unique('work_comic_archive_import_preview_session_task_id_key').on(
      table.taskId,
    ),
    /**
     * 作品ID索引。
     */
    index('work_comic_archive_import_preview_session_work_id_idx').on(
      table.workId,
    ),
    /**
     * 状态和过期时间联合索引。
     */
    index('work_comic_archive_import_preview_session_status_expires_at_idx').on(
      table.status,
      table.expiresAt,
    ),
    /**
     * 预解析会话状态枚举约束。
     */
    check(
      'work_comic_archive_import_preview_session_status_valid_chk',
      sql`${table.status} in (1, 2)`,
    ),
  ],
)

export type WorkComicArchiveImportPreviewSessionSelect =
  typeof workComicArchiveImportPreviewSession.$inferSelect
export type WorkComicArchiveImportPreviewSessionInsert =
  typeof workComicArchiveImportPreviewSession.$inferInsert
