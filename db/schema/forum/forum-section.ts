/**
 * Auto-converted from legacy schema.
 */

import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  smallint,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 论坛板块表 - 管理论坛板块信息，包括板块名称、描述、统计信息等
 */
export const forumSection = pgTable('forum_section', {
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
  name: varchar({ length: 100 }).notNull(),
  /**
   * 板块描述
   */
  description: varchar({ length: 500 }),
  /**
   * 板块图标URL
   */
  icon: varchar({ length: 500 }).notNull(),
  /**
   * 板块封面URL
   */
  cover: varchar({ length: 500 }).notNull(),
  /**
   * 排序值（数值越小越靠前）
   */
  sortOrder: integer().default(0).notNull(),
  /**
   * 是否启用
   */
  isEnabled: boolean().default(true).notNull(),
  /**
   * 主题审核策略（0=不审核；1=严重敏感词触发审核；2=一般敏感词触发审核；3=轻度敏感词触发审核；4=强制人工审核）
   */
  topicReviewPolicy: smallint().default(1).notNull(),
  /**
   * 备注信息
   */
  remark: varchar({ length: 500 }),
  /**
   * 主题数
   */
  topicCount: integer().default(0).notNull(),
  /**
   * 评论数（包含所有可见主题下的评论）
   */
  commentCount: integer().default(0).notNull(),
  /**
   * 关注人数
   */
  followersCount: integer().default(0).notNull(),
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
   * 唯一索引: name（仅未删除板块）
   */
    uniqueIndex('forum_section_name_live_key').on(
      table.name,
    ).where(sql`${table.deletedAt} is null`),
  /**
   * 分组索引
   */
    index('forum_section_group_id_idx').on(table.groupId),
  /**
   * 排序索引
   */
    index('forum_section_sort_order_idx').on(table.sortOrder),
  /**
   * 启用状态索引
   */
    index('forum_section_is_enabled_idx').on(table.isEnabled),
  /**
   * 主题数索引
   */
    index('forum_section_topic_count_idx').on(table.topicCount),
  /**
   * 最后发表时间索引
   */
    index('forum_section_last_post_at_idx').on(table.lastPostAt),
  /**
   * 创建时间索引
   */
    index('forum_section_created_at_idx').on(table.createdAt),
  /**
   * 删除时间索引
   */
    index('forum_section_deleted_at_idx').on(table.deletedAt),
    check(
      'forum_section_topic_review_policy_valid_chk',
      sql`${table.topicReviewPolicy} in (0, 1, 2, 3, 4)`,
    ),
]);

export type ForumSectionSelect = typeof forumSection.$inferSelect
export type ForumSectionInsert = typeof forumSection.$inferInsert
