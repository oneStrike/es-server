/**
 * Auto-converted from Prisma schema.
 */

import { boolean, index, integer, pgTable, smallint, text, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * 系统公告表 - 存储平台公告、活动公告、维护公告等信息
 */
export const appAnnouncement = pgTable("app_announcement", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 关联的页面ID（可选）
   */
  pageId: integer(),
  /**
   * 公告标题
   */
  title: varchar({ length: 100 }).notNull(),
  /**
   * 公告内容
   */
  content: text().notNull(),
  /**
   * 公告摘要
   */
  summary: varchar({ length: 500 }),
  /**
   * 公告类型（0=平台公告, 1=活动公告, 2=维护公告, 3=更新公告, 4=政策公告）
   */
  announcementType: smallint().default(0).notNull(),
  /**
   * 优先级（数值越大越重要）
   */
  priorityLevel: smallint().default(1).notNull(),
  /**
   * 是否已发布
   */
  isPublished: boolean().default(false).notNull(),
  /**
   * 是否置顶
   */
  isPinned: boolean().default(false).notNull(),
  /**
   * 是否以弹窗形式显示
   */
  showAsPopup: boolean().default(false).notNull(),
  /**
   * 弹窗背景图片URL
   */
  popupBackgroundImage: varchar({ length: 200 }),
  /**
   * 启用的平台列表
   */
  enablePlatform: integer().array(),
  /**
   * 发布开始时间
   */
  publishStartTime: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 发布结束时间
   */
  publishEndTime: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 浏览次数
   */
  viewCount: integer().default(0).notNull(),
  /**
   * 创建时间
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 更新时间
   */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
}, (table) => [
  /**
   * 发布状态与发布时间索引
   * 注意：PostgreSQL 索引名最大 63 字符，此名称已被自动截断
   */
  index("app_announcement_is_published_publish_start_time_publish_en_idx").on(table.isPublished, table.publishStartTime, table.publishEndTime),
  /**
   * 类型与发布状态索引
   */
  index("app_announcement_announcement_type_is_published_idx").on(table.announcementType, table.isPublished),
  /**
   * 优先级与置顶索引
   */
  index("app_announcement_priority_level_is_pinned_idx").on(table.priorityLevel, table.isPinned),
  /**
   * 创建时间索引
   */
  index("app_announcement_created_at_idx").on(table.createdAt),
  /**
   * 页面索引
   */
  index("app_announcement_page_id_idx").on(table.pageId),
  /**
   * 弹窗与发布状态索引
   */
  index("app_announcement_show_as_popup_is_published_idx").on(table.showAsPopup, table.isPublished),
]);
