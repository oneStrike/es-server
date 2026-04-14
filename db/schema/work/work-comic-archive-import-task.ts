import { sql } from 'drizzle-orm'
import { boolean, check, index, integer, jsonb, pgTable, smallint, text, timestamp, unique, varchar } from 'drizzle-orm/pg-core'

/**
 * 漫画压缩包导入任务表。
 * 统一持久化预解析草稿、用户确认结果和后台导入执行状态。
 */
export const workComicArchiveImportTask = pgTable(
  'work_comic_archive_import_task',
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
     * 预解析模式（1=单章节压缩包，2=多章节压缩包）。
     */
    mode: smallint().notNull(),
    /**
     * 当前任务状态（0=草稿，1=待处理，2=处理中，3=成功，4=部分失败，5=失败，6=已过期，7=已取消）。
     */
    status: smallint().notNull(),
    /**
     * 原始压缩包文件名。
     */
    archiveName: varchar({ length: 255 }).notNull(),
    /**
     * 原始压缩包本地存储路径。
     */
    archivePath: varchar({ length: 1000 }).notNull(),
    /**
     * 解压目录本地路径。
     */
    extractPath: varchar({ length: 1000 }).notNull(),
    /**
     * 是否需要前端确认。
     */
    requireConfirm: boolean().default(true).notNull(),
    /**
     * 预解析汇总结果。
     */
    summary: jsonb().notNull(),
    /**
     * 章节匹配结果。
     */
    matchedItems: jsonb().notNull(),
    /**
     * 预解析忽略项。
     */
    ignoredItems: jsonb().notNull(),
    /**
     * 正式导入结果。
     */
    resultItems: jsonb().notNull(),
    /**
     * 用户确认的章节ID列表。
     */
    confirmedChapterIds: jsonb().notNull(),
    /**
     * 后台开始处理时间。
     */
    startedAt: timestamp({ withTimezone: true, precision: 6 }),
    /**
     * 后台完成处理时间。
     */
    finishedAt: timestamp({ withTimezone: true, precision: 6 }),
    /**
     * 草稿任务过期时间。
     */
    expiresAt: timestamp({ withTimezone: true, precision: 6 }).notNull(),
    /**
     * 最近一次错误信息。
     */
    lastError: text(),
    /**
     * 创建时间。
     */
    createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
    /**
     * 更新时间。
     */
    updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
  },
  table => [
    /**
     * 任务ID唯一约束。
     */
    unique('work_comic_archive_import_task_task_id_key').on(table.taskId),
    /**
     * 作品ID索引。
     */
    index('work_comic_archive_import_task_work_id_idx').on(table.workId),
    /**
     * 状态索引。
     */
    index('work_comic_archive_import_task_status_idx').on(table.status),
    /**
     * 状态和过期时间联合索引。
     */
    index('work_comic_archive_import_task_status_expires_at_idx').on(
      table.status,
      table.expiresAt,
    ),
    /**
     * 过期时间索引。
     */
    index('work_comic_archive_import_task_expires_at_idx').on(table.expiresAt),
    /**
     * 创建时间索引。
     */
    index('work_comic_archive_import_task_created_at_idx').on(table.createdAt),
    /**
     * 预解析模式枚举约束。
     */
    check(
      'work_comic_archive_import_task_mode_valid_chk',
      sql`${table.mode} in (1, 2)`,
    ),
    /**
     * 任务状态枚举约束。
     */
    check(
      'work_comic_archive_import_task_status_valid_chk',
      sql`${table.status} in (0, 1, 2, 3, 4, 5, 6, 7)`,
    ),
  ],
)

export type WorkComicArchiveImportTaskSelect = typeof workComicArchiveImportTask.$inferSelect
export type WorkComicArchiveImportTaskInsert = typeof workComicArchiveImportTask.$inferInsert
