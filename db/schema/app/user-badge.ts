/**
 * Auto-converted from legacy schema.
 */

import { boolean, index, integer, pgTable, smallint, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * 用户徽章表 - 存储通用用户徽章信息
 */
export const userBadge = pgTable("user_badge", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 徽章名称
   */
  name: varchar({ length: 20 }).notNull(),
  /**
   * 徽章类型（1=系统徽章, 2=成就徽章, 3=活动徽章）
   */
  type: smallint().notNull(),
  /**
   * 徽章描述
   */
  description: varchar({ length: 200 }),
  /**
   * 徽章图标URL
   */
  icon: varchar({ length: 255 }),
  /**
   * 业务域标识（如 forum/comic）
   */
  business: varchar({ length: 20 }),
  /**
   * 事件键（如 forum.topic.create）
   */
  eventKey: varchar({ length: 50 }),
  /**
   * 排序值（数值越小越靠前）
   */
  sortOrder: smallint().default(0).notNull(),
  /**
   * 是否启用
   */
  isEnabled: boolean().default(true).notNull(),
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
     * 类型索引
     */
    index("user_badge_type_idx").on(table.type),
    /**
     * 业务域与事件键索引
     */
    index("user_badge_business_event_key_idx").on(table.business, table.eventKey),
    /**
     * 排序索引
     */
    index("user_badge_sort_order_idx").on(table.sortOrder),
    /**
     * 启用状态索引
     */
    index("user_badge_is_enabled_idx").on(table.isEnabled),
    /**
     * 创建时间索引
     */
    index("user_badge_created_at_idx").on(table.createdAt),
]);
