/**
 * Auto-converted from legacy schema.
 */

import { index, integer, pgTable, primaryKey, timestamp } from "drizzle-orm/pg-core";

/**
 * 论坛主题标签关联表 - 管理主题与标签的多对多关系
 */
export const forumTopicTag = pgTable("forum_topic_tag", {
  /**
   * 关联的主题ID
   */
  topicId: integer().notNull(),
  /**
   * 关联的标签ID
   */
  tagId: integer().notNull(),
  /**
   * 创建时间
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => [
    /**
     * 标签与创建时间索引
     */
    index("forum_topic_tag_tag_id_created_at_idx").on(table.tagId, table.createdAt.desc()),
    /**
     * 主题与标签复合主键
     */
    primaryKey({ columns: [table.topicId, table.tagId] }),
]);
