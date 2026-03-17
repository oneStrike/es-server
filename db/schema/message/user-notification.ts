/**
 * Auto-converted from legacy schema.
 */

import { boolean, index, integer, jsonb, pgTable, smallint, timestamp, unique, varchar } from "drizzle-orm/pg-core";

/**
 * 用户通知表
 * 统一承载站内通知（回复/点赞/收藏/关注/系统消息）
 */
export const userNotification = pgTable("user_notification", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 通知接收用户ID
   */
  userId: integer().notNull(),
  /**
   * 通知类型（1=评论回复,2=评论点赞,3=内容收藏,4=用户关注,5=系统公告,6=聊天消息）
   */
  type: smallint().notNull(),
  /**
   * 幂等业务键（接收人维度）
   */
  bizKey: varchar({ length: 160 }).notNull(),
  /**
   * 触发用户ID
   */
  actorUserId: integer(),
  /**
   * 目标类型
   */
  targetType: smallint(),
  /**
   * 目标ID
   */
  targetId: integer(),
  /**
   * 主体类型（1=评论,2=作品,3=用户,4=系统）
   */
  subjectType: smallint(),
  /**
   * 主体ID
   */
  subjectId: integer(),
  /**
   * 标题
   */
  title: varchar({ length: 200 }).notNull(),
  /**
   * 内容
   */
  content: varchar({ length: 1000 }).notNull(),
  /**
   * 扩展载荷
   */
  payload: jsonb(),
  /**
   * 聚合键
   */
  aggregateKey: varchar({ length: 160 }),
  /**
   * 聚合计数
   */
  aggregateCount: integer().default(1).notNull(),
  /**
   * 已读标记
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
     * 唯一约束：接收人维度幂等
     */
    unique("user_notification_user_id_biz_key_key").on(table.userId, table.bizKey),
    /**
     * 列表查询索引：按已读状态分组分页
     */
    index("user_notification_user_id_is_read_created_at_idx").on(table.userId, table.isRead, table.createdAt.desc()),
    /**
     * 列表查询索引：按时间分页
     */
    index("user_notification_user_id_created_at_idx").on(table.userId, table.createdAt.desc()),
    /**
     * 类型筛选索引
     */
    index("user_notification_type_created_at_idx").on(table.type, table.createdAt.desc()),
    /**
     * 聚合查询索引
     */
    index("user_notification_user_id_aggregate_key_created_at_idx").on(table.userId, table.aggregateKey, table.createdAt.desc()),
]);
