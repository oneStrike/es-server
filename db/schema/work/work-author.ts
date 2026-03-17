/**
 * Auto-converted from legacy schema.
 */

import { boolean, index, integer, pgTable, smallint, timestamp, unique, varchar } from "drizzle-orm/pg-core";

/**
 * 作者信息模型
 */
export const workAuthor = pgTable("work_author", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 作者姓名
   */
  name: varchar({ length: 100 }).notNull(),
  /**
   * 作者头像URL
   */
  avatar: varchar({ length: 500 }),
  /**
   * 作者描述
   */
  description: varchar({ length: 1000 }),
  /**
   * 国籍
   */
  nationality: varchar({ length: 50 }),
  /**
   * 性别（0: 未知, 1: 男性, 2: 女性, 3: 其他）
   */
  gender: smallint().default(0).notNull(),
  /**
   * 作者类型（1: 漫画家, 2: 轻小说作者）
   */
  type: smallint().array(),
  /**
   * 启用状态（true: 启用, false: 禁用）
   */
  isEnabled: boolean().default(true).notNull(),
  /**
   * 是否为推荐作者（用于前台推荐展示）
   */
  isRecommended: boolean().default(false).notNull(),
  /**
   * 管理员备注
   */
  remark: varchar({ length: 1000 }),
  /**
   * 作品数量（冗余字段，用于提升查询性能）
   */
  workCount: integer().default(0).notNull(),
  /**
   * 粉丝数量（冗余字段，用于前台展示）
   */
  followersCount: integer().default(0).notNull(),
  /**
   * 创建时间
   */
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 更新时间
   */
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
  /**
   * 软删除时间（用于数据恢复或归档）
   */
  deletedAt: timestamp({ withTimezone: true, precision: 6 }),
}, (table) => [
    /**
     * 唯一索引: name
     */
    unique("work_author_name_key").on(table.name),
    /**
     * 作者类型索引
     */
    index("work_author_type_idx").on(table.type),
    /**
     * 启用状态索引
     */
    index("work_author_is_enabled_idx").on(table.isEnabled),
    /**
     * 启用与推荐索引
     */
    index("work_author_is_enabled_is_recommended_idx").on(table.isEnabled, table.isRecommended),
    /**
     * 启用与删除时间索引
     */
    index("work_author_is_enabled_deleted_at_idx").on(table.isEnabled, table.deletedAt),
    /**
     * 国籍索引
     */
    index("work_author_nationality_idx").on(table.nationality),
    /**
     * 性别索引
     */
    index("work_author_gender_idx").on(table.gender),
    /**
     * 推荐与作品数索引
     */
    index("work_author_is_recommended_work_count_idx").on(table.isRecommended, table.workCount.desc()),
    /**
     * 创建时间索引
     */
    index("work_author_created_at_idx").on(table.createdAt),
]);
