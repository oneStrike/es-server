/**
 * Auto-converted from Prisma schema.
 */

import { boolean, index, integer, jsonb, pgTable, smallint, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { appUser } from "../app/app-user";
import { forumSection } from "./forum-section";

/**
 * 论坛主题表
 */
export const forumTopic = pgTable("forum_topic", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 版块ID
   */
  sectionId: integer().references(() => forumSection.id, { onDelete: "cascade", onUpdate: "cascade" }).notNull(),
  /**
   * 发帖用户ID
   */
  userId: integer().references(() => appUser.id, { onDelete: "restrict", onUpdate: "cascade" }).notNull(),
  /**
   * 最后回复用户ID
   */
  lastReplyUserId: integer().references(() => appUser.id, { onDelete: "set null", onUpdate: "cascade" }),
  /**
   * 审核人ID
   */
  auditById: integer(),
  /**
   * 标题
   */
  title: varchar({ length: 200 }).notNull(),
  /**
   * 内容
   */
  content: text().notNull(),
  /**
   * 是否置顶
   */
  isPinned: boolean().default(false).notNull(),
  /**
   * 是否精选
   */
  isFeatured: boolean().default(false).notNull(),
  /**
   * 是否锁定
   */
  isLocked: boolean().default(false).notNull(),
  /**
   * 是否隐藏
   */
  isHidden: boolean().default(false).notNull(),
  /**
   * 审核状态
   */
  auditStatus: smallint().default(1).notNull(),
  /**
   * 审核角色
   */
  auditRole: smallint(),
  /**
   * 审核原因
   */
  auditReason: varchar({ length: 500 }),
  /**
   * 审核时间
   */
  auditAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 乐观锁版本号
   */
  version: integer().default(0).notNull(),
  /**
   * 敏感词命中记录
   */
  sensitiveWordHits: jsonb(),
  /**
   * 浏览数
   */
  viewCount: integer().default(0).notNull(),
  /**
   * 回复数
   */
  replyCount: integer().default(0).notNull(),
  /**
   * 点赞数
   */
  likeCount: integer().default(0).notNull(),
  /**
   * 评论数
   */
  commentCount: integer().default(0).notNull(),
  /**
   * 收藏数
   */
  favoriteCount: integer().default(0).notNull(),
  /**
   * 最后回复时间
   */
  lastReplyAt: timestamp({ withTimezone: true, precision: 6 }),
  /**
   * 创建时间
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 更新时间
   */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
  /**
   * 删除时间
   */
  deletedAt: timestamp({ withTimezone: true, precision: 6 }),
}, (table) => [
    /**
     * 索引: sectionId
     */
    index("forum_topic_section_id_idx").on(table.sectionId),
    /**
     * 索引: userId
     */
    index("forum_topic_user_id_idx").on(table.userId),
    /**
     * 索引: isPinned, createdAt
     */
    index("forum_topic_is_pinned_created_at_idx").on(table.isPinned, table.createdAt),
    /**
     * 索引: isFeatured, createdAt
     */
    index("forum_topic_is_featured_created_at_idx").on(table.isFeatured, table.createdAt),
    /**
     * 索引: isLocked
     */
    index("forum_topic_is_locked_idx").on(table.isLocked),
    /**
     * 索引: isHidden
     */
    index("forum_topic_is_hidden_idx").on(table.isHidden),
    /**
     * 索引: auditStatus
     */
    index("forum_topic_audit_status_idx").on(table.auditStatus),
    /**
     * 索引: viewCount
     */
    index("forum_topic_view_count_idx").on(table.viewCount),
    /**
     * 索引: replyCount
     */
    index("forum_topic_reply_count_idx").on(table.replyCount),
    /**
     * 索引: likeCount
     */
    index("forum_topic_like_count_idx").on(table.likeCount),
    /**
     * 索引: commentCount
     */
    index("forum_topic_comment_count_idx").on(table.commentCount),
    /**
     * 索引: favoriteCount
     */
    index("forum_topic_favorite_count_idx").on(table.favoriteCount),
    /**
     * 索引: lastReplyAt
     */
    index("forum_topic_last_reply_at_idx").on(table.lastReplyAt),
    /**
     * 索引: createdAt
     */
    index("forum_topic_created_at_idx").on(table.createdAt),
    /**
     * 索引: updatedAt
     */
    index("forum_topic_updated_at_idx").on(table.updatedAt),
    /**
     * 索引: deletedAt
     */
    index("forum_topic_deleted_at_idx").on(table.deletedAt),
    /**
     * 索引: sectionId, isPinned, createdAt
     */
    index("forum_topic_section_id_is_pinned_created_at_idx").on(table.sectionId, table.isPinned, table.createdAt),
    /**
     * 索引: sectionId, isFeatured, createdAt
     */
    index("forum_topic_section_id_is_featured_created_at_idx").on(table.sectionId, table.isFeatured, table.createdAt),
    /**
     * 索引: sectionId, lastReplyAt
     */
    index("forum_topic_section_id_last_reply_at_idx").on(table.sectionId, table.lastReplyAt),
]);

