/**
 * Auto-converted from legacy schema.
 */

import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  smallint,
  snakeCase,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

/**
 * 用户下载记录表
 * 记录用户对作品、章节等内容的下载操作
 * 支持下载计数统计和用户下载历史查询
 */
export const userDownloadRecord = snakeCase.table(
  'user_download_record',
  {
    /**
     * 主键ID（自增）
     */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 目标类型 1=漫画章节, 2=小说章节
     */
    targetType: smallint().notNull(),
    /**
     * 目标ID
     */
    targetId: integer().notNull(),
    /**
     * 用户ID（关联 app_user.id）
     */
    userId: integer().notNull(),
    /**
     * 创建时间（下载时间）
     */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    /**
     * 唯一约束：同一用户对同一章节只能有一条下载记录
     * 确保下载操作幂等，避免重复计数
     */
    unique('user_download_record_target_type_target_id_user_id_key').on(
      table.targetType,
      table.targetId,
      table.userId,
    ),
    /**
     * 目标类型与目标ID联合索引
     */
    index('user_download_record_target_type_target_id_idx').on(
      table.targetType,
      table.targetId,
    ),
    /**
     * 用户ID索引
     */
    index('user_download_record_user_id_idx').on(table.userId),
    /**
     * 创建时间索引
     */
    index('user_download_record_created_at_idx').on(table.createdAt),
    check(
      'user_download_record_target_type_valid_chk',
      sql`${table.targetType} in (1, 2)`,
    ),
  ],
)

export type UserDownloadRecordSelect = typeof userDownloadRecord.$inferSelect
export type UserDownloadRecordInsert = typeof userDownloadRecord.$inferInsert
