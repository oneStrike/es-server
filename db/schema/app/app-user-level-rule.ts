/**
 * Auto-converted from legacy schema.
 */

import { boolean, index, integer, numeric, pgTable, smallint, timestamp, unique, varchar } from "drizzle-orm/pg-core";

/**
 * 用户等级规则表 - 定义用户等级规则，包括等级名称、所需经验、等级权益等
 */
export const appUserLevelRule = pgTable("app_user_level_rule", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 等级名称
   */
  name: varchar({ length: 20 }).notNull(),
  /**
   * 所需经验值
   */
  requiredExperience: integer().notNull(),
  /**
   * 所需登录天数
   */
  loginDays: smallint().default(0).notNull(),
  /**
   * 等级描述
   */
  description: varchar({ length: 200 }),
  /**
   * 等级图标URL
   */
  icon: varchar({ length: 255 }),
  /**
   * 等级徽章URL
   */
  badge: varchar({ length: 255 }),
  /**
   * 等级专属颜色（十六进制）
   */
  color: varchar({ length: 20 }),
  /**
   * 排序值（数值越小越靠前）
   */
  sortOrder: smallint().default(0).notNull(),
  /**
   * 是否启用
   */
  isEnabled: boolean().default(true).notNull(),
  /**
   * 业务域标识（可选）
   */
  business: varchar({ length: 20 }),
  /**
   * 每日发帖数量上限，0表示无限制
   */
  dailyTopicLimit: smallint().default(0).notNull(),
  /**
   * 每日回复和评论数量上限，0表示无限制
   */
  dailyReplyCommentLimit: smallint().default(0).notNull(),
  /**
   * 发帖间隔秒数（防刷屏），0表示无限制
   */
  postInterval: smallint().default(0).notNull(),
  /**
   * 每日点赞次数上限，0表示无限制
   */
  dailyLikeLimit: smallint().default(0).notNull(),
  /**
   * 每日收藏次数上限，0表示无限制
   */
  dailyFavoriteLimit: smallint().default(0).notNull(),
  /**
   * 黑名单上限
   */
  blacklistLimit: smallint().default(10).notNull(),
  /**
   * 作品收藏上限
   */
  workCollectionLimit: smallint().default(100).notNull(),
  /**
   * 积分购买折扣（0-1之间的小数，0表示不打折）
   */
  discount: numeric({ precision: 3, scale: 2 }).default("0.00").notNull(),
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
     * 唯一索引: name
     */
    unique("app_user_level_rule_name_key").on(table.name),
    /**
     * 启用与排序索引
     */
    index("app_user_level_rule_is_enabled_sort_order_idx").on(table.isEnabled, table.sortOrder),
]);

export type AppUserLevelRuleSelect = typeof appUserLevelRule.$inferSelect;
export type AppUserLevelRuleInsert = typeof appUserLevelRule.$inferInsert;
