/**
 * Auto-converted from Prisma schema.
 */

import { index, integer, pgTable, timestamp, unique } from "drizzle-orm/pg-core";

/**
 * 系统公告阅读记录表 - 记录用户已读的公告
 */
export const appAnnouncementRead = pgTable("app_announcement_read", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
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
   * 公告与用户唯一约束
   */
  unique("app_announcement_read_announcement_id_user_id_key").on(table.announcementId, table.userId),
  /**
   * 公告索引
   */
  index("app_announcement_read_announcement_id_idx").on(table.announcementId),
  /**
   * 用户索引
   */
  index("app_announcement_read_user_id_idx").on(table.userId),
  /**
   * 阅读时间索引
   */
  index("app_announcement_read_read_at_idx").on(table.readAt),
]);
