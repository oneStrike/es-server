/**
 * Auto-converted from Prisma schema.
 */

import { boolean, index, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * 论坛板块表 - 管理论坛板块信息，包括板块名称、描述、统计信息等
 */
export const forumSection = pgTable("forum_section", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 板块分组ID（可选，用于将板块分组管理）
   */
  groupId: integer(),
  /**
   * 用户的论坛等级规则ID
   */
  userLevelRuleId: integer(),
  /**
   * 最后发表主题ID
   */
  lastTopicId: integer(),
  /**
   * 板块名称
   */
  name: varchar({ length: 50 }).notNull(),
  /**
   * 板块描述
   */
  description: varchar({ length: 500 }),
  /**
   * 板块图标URL
   */
  icon: varchar({ length: 255 }),
  /**
   * 排序值（数值越小越靠前）
   */
  sortOrder: integer().default(0).notNull(),
  /**
   * 是否启用
   */
  isEnabled: boolean().default(true).notNull(),
  /**
   * 主题审核策略 （0：无需审核，1：触发严重敏感词时审核，2：触一般敏感词时审核，3：触发轻微敏感词时审核，4：强制人工审核）
   */
  topicReviewPolicy: integer().default(1).notNull(),
  /**
   * 备注信息
   */
  remark: varchar({ length: 500 }),
  /**
   * 主题数
   */
  topicCount: integer().default(0).notNull(),
  /**
   * 回复数（包含所有子版块）
   */
  replyCount: integer().default(0).notNull(),
  /**
   * 最后发表时间
   */
  lastPostAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 创建时间
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 更新时间
   */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
  /**
   * 软删除时间
   */
  deletedAt: timestamp({ withTimezone: true, precision: 6 }),
}, (table) => [
  /**
   * 分组索引
   */
  index("forum_section_group_id_idx").on(table.groupId),
  /**
   * 排序索引
   */
  index("forum_section_sort_order_idx").on(table.sortOrder),
  /**
   * 启用状态索引
   */
  index("forum_section_is_enabled_idx").on(table.isEnabled),
  /**
   * 主题数索引
   */
  index("forum_section_topic_count_idx").on(table.topicCount),
  /**
   * 最后发表时间索引
   */
  index("forum_section_last_post_at_idx").on(table.lastPostAt),
  /**
   * 创建时间索引
   */
  index("forum_section_created_at_idx").on(table.createdAt),
  /**
   * 删除时间索引
   */
  index("forum_section_deleted_at_idx").on(table.deletedAt),
]);
