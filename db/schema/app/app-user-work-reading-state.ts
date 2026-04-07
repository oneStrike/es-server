/**
 * Auto-converted from legacy schema.
 */

import { index, integer, pgTable, primaryKey, smallint, timestamp } from "drizzle-orm/pg-core";

/**
 * 用户作品阅读状态表
 * 用于保存用户对作品（漫画/小说）的阅读进度状态
 */
export const appUserWorkReadingState = pgTable("app_user_work_reading_state", {
  /**
   * 用户 ID
   */
  userId: integer().notNull(),
  /**
   * 作品 ID
   */
  workId: integer().notNull(),
  /**
   * 作品类型（1=漫画, 2=小说）
   */
  workType: smallint().notNull(),
  /**
   * 最近一次阅读时间
   */
  lastReadAt: timestamp({ withTimezone: true, precision: 6 }).notNull(),
  /**
   * 最近一次阅读到的章节 ID，用于继续阅读
   */
  lastReadChapterId: integer(),
}, (table) => [
    /**
     * 用户按类型查看最近阅读作品时使用
     */
    index("app_user_work_reading_state_user_id_work_type_last_read_at_idx").on(table.userId, table.workType, table.lastReadAt.desc()),
    /**
     * 用户最近阅读列表索引
     */
    index("app_user_work_reading_state_user_id_last_read_at_idx").on(table.userId, table.lastReadAt.desc()),
    /**
     * 作品维度查询阅读状态时使用
     */
    index("app_user_work_reading_state_work_id_idx").on(table.workId),
    /**
     * 继续阅读关联章节查询时使用
     */
    index("app_user_work_reading_state_last_read_chapter_id_idx").on(table.lastReadChapterId),
    /**
     * 用户与作品复合主键
     */
    primaryKey({ columns: [table.userId, table.workId] }),
]);

export type AppUserWorkReadingStateSelect = typeof appUserWorkReadingState.$inferSelect;
export type AppUserWorkReadingStateInsert = typeof appUserWorkReadingState.$inferInsert;
