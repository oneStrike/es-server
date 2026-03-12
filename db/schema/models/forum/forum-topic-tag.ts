/**
 * Auto-converted from Prisma schema.
 */

import { index, integer, pgTable, timestamp, unique } from "drizzle-orm/pg-core";
import { forumTag } from "./forum-tag";
import { forumTopic } from "./forum-topic";

/**
 * 论坛主题标签关联表 - 管理主题与标签的多对多关系
 */
export const forumTopicTag = pgTable("forum_topic_tag", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 关联的主题ID
   */
  topicId: integer().references(() => forumTopic.id, { onDelete: "cascade", onUpdate: "cascade" }).notNull(),
  /**
   * 关联的标签ID
   */
  tagId: integer().references(() => forumTag.id, { onDelete: "cascade", onUpdate: "cascade" }).notNull(),
  /**
   * 创建时间
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => [
    /**
     * 主题与标签唯一约束
     */
    unique("forum_topic_tag_topic_id_tag_id_key").on(table.topicId, table.tagId),
    /**
     * 主题索引
     */
    index("forum_topic_tag_topic_id_idx").on(table.topicId),
    /**
     * 标签索引
     */
    index("forum_topic_tag_tag_id_idx").on(table.tagId),
    /**
     * 创建时间索引
     */
    index("forum_topic_tag_created_at_idx").on(table.createdAt),
]);

