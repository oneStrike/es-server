/**
 * Auto-converted from Prisma schema.
 */

import { boolean, index, integer, pgTable, smallint, timestamp, unique, varchar } from "drizzle-orm/pg-core";

/**
 * 通用敏感词表 - 存储敏感词信息，用于内容过滤和审核
 */
export const sensitiveWord = pgTable("sensitive_word", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 敏感词
   */
  word: varchar({ length: 100 }).notNull(),
  /**
   * 替换词
   */
  replaceWord: varchar({ length: 100 }),
  /**
   * 敏感词级别（1=严重, 2=一般, 3=轻微）
   */
  level: smallint().default(2).notNull(),
  /**
   * 敏感词类型（1=政治, 2=色情, 3=暴力, 4=广告, 5=其他）
   */
  type: smallint().default(5).notNull(),
  /**
   * 匹配模式（1=精确匹配, 2=模糊匹配, 3=正则匹配）
   */
  matchMode: smallint().default(1).notNull(),
  /**
   * 是否启用
   */
  isEnabled: boolean().default(true).notNull(),
  /**
   * 版本号（用于乐观锁）
   */
  version: integer().default(0).notNull(),
  /**
   * 备注
   */
  remark: varchar({ length: 500 }),
  /**
   * 创建人ID
   */
  createdBy: integer(),
  /**
   * 更新人ID
   */
  updatedBy: integer(),
  /**
   * 命中次数
   */
  hitCount: integer().default(0).notNull(),
  /**
   * 最后命中时间
   */
  lastHitAt: timestamp({ withTimezone: true, precision: 6 }),
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
     * 唯一索引: word
     */
    unique("sensitive_word_word_key").on(table.word),
    /**
     * 敏感词索引
     */
    index("sensitive_word_word_idx").on(table.word),
    /**
     * 类型索引
     */
    index("sensitive_word_type_idx").on(table.type),
    /**
     * 级别索引
     */
    index("sensitive_word_level_idx").on(table.level),
    /**
     * 启用状态索引
     */
    index("sensitive_word_is_enabled_idx").on(table.isEnabled),
    /**
     * 匹配模式索引
     */
    index("sensitive_word_match_mode_idx").on(table.matchMode),
    /**
     * 创建时间索引
     */
    index("sensitive_word_created_at_idx").on(table.createdAt),
]);

