/**
 * Auto-converted from legacy schema.
 */

import { boolean, index, integer, pgTable, smallint, timestamp, unique, varchar } from "drizzle-orm/pg-core";

/**
 * 用户经验规则表 - 定义经验获取规则，包括发帖、回复、点赞、签到等
 */
export const userExperienceRule = pgTable("user_experience_rule", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 规则类型（取值见成长规则枚举）。
   * 举报奖励当前以“举报有效 / 举报无效”表达裁决结果，章节类编码统一收敛到 300 / 400 段。
   */
  type: smallint().notNull(),
  /**
   * 经验奖励值（正整数）
   */
  experience: integer().notNull(),
  /**
   * 每日上限（0=无限制，禁止负值）
   */
  dailyLimit: integer().default(0).notNull(),
  /**
   * 总上限（0=无限制，禁止负值）
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
    unique("user_experience_rule_type_key").on(table.type),
    /**
     * 类型索引
     */
    index("user_experience_rule_type_idx").on(table.type),
    /**
     * 启用状态索引
     */
    index("user_experience_rule_is_enabled_idx").on(table.isEnabled),
    /**
     * 创建时间索引
     */
    index("user_experience_rule_created_at_idx").on(table.createdAt),
]);
