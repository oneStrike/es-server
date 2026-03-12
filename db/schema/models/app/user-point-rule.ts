/**
 * Auto-converted from Prisma schema.
 */

import { boolean, index, integer, pgTable, smallint, timestamp, unique, varchar } from "drizzle-orm/pg-core";

/**
 * 用户积分规则表 - 定义积分获取和消费规则，包括发帖、回复、点赞、签到等
 */
export const userPointRule = pgTable("user_point_rule", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 规则类型（1=发表主题, 2=发表回复, 3=主题被点赞, 4=回复被点赞, 5=主题被收藏, 6=每日签到, 7=管理员操作, 8=主题浏览, 9=举报, 101=漫画浏览, 102=漫画点赞, 103=漫画收藏, 111=章节阅读, 112=章节点赞, 113=章节购买, 114=章节下载）
   */
  type: smallint().notNull(),
  /**
   * 积分变化（正数为获得，负数为扣除）
   */
  points: integer().notNull(),
  /**
   * 每日上限（0=无限制）
   */
  dailyLimit: integer().default(0).notNull(),
  /**
   * 总上限（0=无限制）
   */
  totalLimit: integer().default(0).notNull(),
  /**
   * 是否启用
   */
  isEnabled: boolean().default(true).notNull(),
  /**
   * 备注
   */
  remark: varchar({ length: 500 }),
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
     * 唯一索引: type
     */
    unique("user_point_rule_type_key").on(table.type),
    /**
     * 类型索引
     */
    index("user_point_rule_type_idx").on(table.type),
    /**
     * 启用状态索引
     */
    index("user_point_rule_is_enabled_idx").on(table.isEnabled),
    /**
     * 创建时间索引
     */
    index("user_point_rule_created_at_idx").on(table.createdAt),
]);
