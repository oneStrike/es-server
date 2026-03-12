/**
 * Auto-converted from Prisma schema.
 */

import { boolean, index, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { appUser } from "../app/app-user";

/**
 * 论坛配置表 - 存储论坛系统的各项配置，采用直接字段方式定义
 */
export const forumConfig = pgTable("forum_config", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 最后修改人ID
   */
  updatedById: integer().references(() => appUser.id, { onDelete: "set null", onUpdate: "cascade" }),
  /**
   * 站点名称
   */
  siteName: varchar({ length: 100 }).notNull(),
  /**
   * 站点描述
   */
  siteDescription: varchar({ length: 500 }),
  /**
   * 站点关键词
   */
  siteKeywords: varchar({ length: 200 }),
  /**
   * 站点Logo URL
   */
  siteLogo: varchar({ length: 255 }),
  /**
   * 站点Favicon URL
   */
  siteFavicon: varchar({ length: 255 }),
  /**
   * 联系邮箱
   */
  contactEmail: varchar({ length: 100 }),
  /**
   * 备案号
   */
  icpNumber: varchar({ length: 50 }),
  /**
   * 主题标题最大长度
   */
  topicTitleMaxLength: integer().default(200).notNull(),
  /**
   * 主题内容最大长度
   */
  topicContentMaxLength: integer().default(10000).notNull(),
  /**
   * 回复内容最大长度
   */
  replyContentMaxLength: integer().default(5000).notNull(),
  /**
   * 审核策略（0：无需审核，1：触发严重敏感词时审核，2：触一般敏感词时审核，3：触发轻微敏感词时审核，4：强制人工审核）
   */
  reviewPolicy: integer().default(1).notNull(),
  /**
   * 是否允许匿名浏览
   */
  allowAnonymousView: boolean().default(true).notNull(),
  /**
   * 是否允许匿名发帖
   */
  allowAnonymousPost: boolean().default(false).notNull(),
  /**
   * 是否允许匿名回复
   */
  allowAnonymousReply: boolean().default(false).notNull(),
  /**
   * 是否允许用户注册
   */
  allowUserRegister: boolean().default(true).notNull(),
  /**
   * 注册是否需要邮箱验证
   */
  registerRequireEmailVerify: boolean().default(true).notNull(),
  /**
   * 注册是否需要手机验证
   */
  registerRequirePhoneVerify: boolean().default(false).notNull(),
  /**
   * 用户名最小长度
   */
  usernameMinLength: integer().default(3).notNull(),
  /**
   * 用户名最大长度
   */
  usernameMaxLength: integer().default(20).notNull(),
  /**
   * 签名最大长度
   */
  signatureMaxLength: integer().default(200).notNull(),
  /**
   * 个人简介最大长度
   */
  bioMaxLength: integer().default(500).notNull(),
  /**
   * 新注册用户默认发放的积分
   */
  defaultPointsForNewUser: integer().default(100).notNull(),
  /**
   * 是否启用邮件通知
   */
  enableEmailNotification: boolean().default(true).notNull(),
  /**
   * 是否启用站内通知
   */
  enableInAppNotification: boolean().default(true).notNull(),
  /**
   * 是否启用新主题通知
   */
  enableNewTopicNotification: boolean().default(true).notNull(),
  /**
   * 是否启用新回复通知
   */
  enableNewReplyNotification: boolean().default(true).notNull(),
  /**
   * 是否启用点赞通知
   */
  enableLikeNotification: boolean().default(true).notNull(),
  /**
   * 是否启用收藏通知
   */
  enableFavoriteNotification: boolean().default(true).notNull(),
  /**
   * 是否启用系统通知
   */
  enableSystemNotification: boolean().default(true).notNull(),
  /**
   * 是否启用站点维护模式
   */
  enableMaintenanceMode: boolean().default(false).notNull(),
  /**
   * 维护模式提示信息
   */
  maintenanceMessage: varchar({ length: 500 }),
  /**
   * 创建时间
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 最后修改时间
   */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
}, (table) => [
    /**
     * 按最后修改人查询配置
     */
    index("forum_config_updated_by_id_idx").on(table.updatedById),
    /**
     * 按创建时间追踪配置变更
     */
    index("forum_config_created_at_idx").on(table.createdAt),
]);

