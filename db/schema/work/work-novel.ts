/**
 * Auto-converted from legacy schema.
 */

import { integer, snakeCase, timestamp, unique } from 'drizzle-orm/pg-core'

/**
 * 小说作品扩展表
 */
export const workNovel = snakeCase.table(
  'work_novel',
  {
    /**
     * 主键id
     */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /**
     * 关联的作品ID
     */
    workId: integer().notNull(),
    /**
     * 总字数
     */
    wordCount: integer().default(0).notNull(),
    /**
     * 创建时间
     */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /**
     * 更新时间
     */
    updatedAt: timestamp({ withTimezone: true, precision: 6 })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    /**
     * 唯一索引: workId
     */
    unique('work_novel_work_id_key').on(table.workId),
  ],
)
