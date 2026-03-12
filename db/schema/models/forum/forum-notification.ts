/**
 * Auto-converted from Prisma schema.
 */

import { boolean, index, integer, pgTable, smallint, timestamp, varchar } from "drizzle-orm/pg-core";
import { appUser } from "../app/app-user";
import { forumTopic } from "./forum-topic";

/**
 * 论坛通知表
 */
export const forumNotification = pgTable("forum_notification", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 通知接收用户ID
   */
  userId: integer().references(() => appUser.id, { onDelete: "cascade", onUpdate: "cascade" }).notNull(),
  /**
   * 关联主题ID
   */
  topicId: integer().references(() => forumTopic.id, { onDelete: "cascade", onUpdate: "cascade" }),
  /**
   * 关联回复ID（兼容历史字段）
   */
  replyId: integer(),
  /**
   * 通知类型
   */
  type: smallint().notNull(),
  /**
   * 优先级
   */
  priority: smallint().default(1).notNull(),
  /**
   * 标题
   */
  title: varchar({ length: 200 }).notNull(),
  /**
   * 内容
   */
  content: varchar({ length: 1000 }).notNull(),
  /**
   * 是否已读
   */
  isRead: boolean().default(false).notNull(),
  /**
   * 已读时间
   */
  readAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 过期时间
   */
  expiredAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 创建时间
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
}, (table) => [
    /**
     * 索引: userId
     */
    index("forum_notification_user_id_idx").on(table.userId),
    /**
     * 索引: topicId
     */
    index("forum_notification_topic_id_idx").on(table.topicId),
    /**
     * 索引: replyId
     */
    index("forum_notification_reply_id_idx").on(table.replyId),
    /**
     * 索引: type
     */
    index("forum_notification_type_idx").on(table.type),
    /**
     * 索引: priority
     */
    index("forum_notification_priority_idx").on(table.priority),
    /**
     * 索引: isRead
     */
    index("forum_notification_is_read_idx").on(table.isRead),
    /**
     * 索引: expiredAt
     */
    index("forum_notification_expired_at_idx").on(table.expiredAt),
    /**
     * 索引: createdAt
     */
    index("forum_notification_created_at_idx").on(table.createdAt),
    /**
     * 索引: userId, isRead
     */
    index("forum_notification_user_id_is_read_idx").on(table.userId, table.isRead),
    /**
     * 索引: userId, priority
     */
    index("forum_notification_user_id_priority_idx").on(table.userId, table.priority),
    /**
     * 索引: userId, createdAt
     */
    index("forum_notification_user_id_created_at_idx").on(table.userId, table.createdAt),
]);

