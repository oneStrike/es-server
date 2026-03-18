/**
 * Auto-converted from legacy schema.
 */

import { boolean, index, integer, jsonb, pgTable, smallint, text, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * 用户评论表
 * 统一存储作品评论、章节评论和论坛回复
 */
export const userComment = pgTable("user_comment", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 目标类型（1=漫画，2=小说，3=漫画章节，4=小说章节，5=论坛主题）
   */
  targetType: smallint().notNull(),
  /**
   * 目标ID
   */
  targetId: integer().notNull(),
  /**
   * 评论用户ID
   */
  userId: integer().notNull(),
  /**
   * 评论内容
   */
  content: text().notNull(),
  /**
   * 楼层号
   */
  floor: integer(),
  /**
   * 回复目标评论ID
   */
  replyToId: integer(),
  /**
   * 实际回复的根评论ID
   */
  actualReplyToId: integer(),
  /**
   * 是否隐藏
   */
  isHidden: boolean().default(false).notNull(),
  /**
   * 审核状态（0=待审核，1=通过，2=拒绝）
   */
  auditStatus: smallint().default(0).notNull(),
  /**
   * 审核人ID
   */
  auditById: integer(),
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
   * 点赞数
   */
  likeCount: integer().default(0).notNull(),
  /**
   * 敏感词命中记录
   */
  sensitiveWordHits: jsonb(),
  /**
   * 创建时间
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 更新时间
   */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
  /**
   * 删除时间（软删除）
   */
  deletedAt: timestamp({ withTimezone: true, precision: 6 }),
}, (table) => [
    /**
     * 目标维度时间索引
     */
    index("user_comment_target_type_target_id_created_at_idx").on(table.targetType, table.targetId, table.createdAt),
    /**
     * 楼层查询索引
     */
    index("user_comment_target_type_target_id_reply_to_id_floor_idx").on(table.targetType, table.targetId, table.replyToId, table.floor),
    /**
     * 可见评论索引
     * 注意：PostgreSQL 索引名最大 63 字符，此名称已被自动截断
     */
    index("user_comment_target_type_target_id_audit_status_is_hidden_d_idx").on(table.targetType, table.targetId, table.auditStatus, table.isHidden, table.deletedAt),
    /**
     * 回复分页索引
     * 注意：PostgreSQL 索引名最大 63 字符，此名称已被自动截断
     */
    index("user_comment_actual_reply_to_id_audit_status_is_hidden_dele_idx").on(table.actualReplyToId, table.auditStatus, table.isHidden, table.deletedAt, table.createdAt),
    /**
     * 目标删除时间索引
     */
    index("user_comment_target_type_target_id_deleted_at_created_at_idx").on(table.targetType, table.targetId, table.deletedAt, table.createdAt),
    /**
     * 用户索引
     */
    index("user_comment_user_id_idx").on(table.userId),
    /**
     * 创建时间索引
     */
    index("user_comment_created_at_idx").on(table.createdAt),
    /**
     * 审核状态索引
     */
    index("user_comment_audit_status_idx").on(table.auditStatus),
    /**
     * 隐藏状态索引
     */
    index("user_comment_is_hidden_idx").on(table.isHidden),
    /**
     * 回复目标索引
     */
    index("user_comment_reply_to_id_idx").on(table.replyToId),
    /**
     * 实际回复目标索引
     */
    index("user_comment_actual_reply_to_id_idx").on(table.actualReplyToId),
    /**
     * 删除时间索引
     */
    index("user_comment_deleted_at_idx").on(table.deletedAt),
]);

export type UserComment = typeof userComment.$inferSelect;
export type UserCommentInsert = typeof userComment.$inferInsert;
