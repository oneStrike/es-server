/**
 * Auto-converted from legacy schema.
 */

import { index, integer, jsonb, pgTable, timestamp } from "drizzle-orm/pg-core";

/**
 * 系统配置
 */
export const systemConfig = pgTable("sys_config", {
  /**
   * 主键id
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 最后修改人ID
   */
  updatedById: integer(),
  /**
   * 阿里云配置（JSON格式，包含 accessKeyId/accessKeySecret）
   */
  aliyunConfig: jsonb(),
  /**
   * 站点基础配置（JSON格式，名称/描述/关键词/Logo等）
   */
  siteConfig: jsonb(),
  /**
   * 维护模式配置（JSON格式，开关与提示文案）
   */
  maintenanceConfig: jsonb(),
  /**
   * 内容审核策略（JSON格式，敏感词等级处理策略）
   */
  contentReviewPolicy: jsonb(),
  /**
   * 上传配置（JSON格式，包含 provider/七牛/Superbed 配置）
   */
  uploadConfig: jsonb(),
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
     * 更新人索引
     */
    index("sys_config_updated_by_id_idx").on(table.updatedById),
    /**
     * 创建时间降序索引（用于快速查询最新配置）
     */
    index("sys_config_created_at_idx").on(table.createdAt.desc()),
]);

export type SystemConfigSelect = typeof systemConfig.$inferSelect;
export type SystemConfigInsert = typeof systemConfig.$inferInsert;
