/**
 * Auto-converted from legacy schema.
 */

import { index, integer, pgTable, primaryKey, timestamp } from "drizzle-orm/pg-core";

/**
 * 系统公告阅读记录表 - 记录用户已读的公告
 */
export const appAnnouncementRead = pgTable("app_announcement_read", {
  /**
   * 关联的公告ID
   */
  announcementId: integer().notNull(),
  /**
   * 关联的用户ID
   */
  userId: integer().notNull(),
  /**
   * 阅读时间
   */
  readAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => [
  /**
   * 用户与阅读时间索引
   */
  index("app_announcement_read_user_id_read_at_idx").on(table.userId, table.readAt.desc()),
  /**
   * 公告与用户复合主键
   */
  primaryKey({ columns: [table.announcementId, table.userId] }),
]);

export type AppAnnouncementRead = typeof appAnnouncementRead.$inferSelect;
export type AppAnnouncementReadInsert = typeof appAnnouncementRead.$inferInsert;
