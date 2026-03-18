/**
 * Auto-converted from legacy schema.
 */

import { bigint, boolean, index, integer, pgTable, text, timestamp, unique, varchar } from "drizzle-orm/pg-core";

/**
 * 应用协议表 - 存储隐私政策、用户协议等
 */
export const appAgreement = pgTable("app_agreement", {
  /**
   * 主键ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 协议标题
   */
  title: varchar({ length: 200 }).notNull(),
  /**
   * 协议内容 (HTML/Markdown)
   */
  content: text().notNull(),
  /**
   * 版本号 (如 1.0.0, 20231027)
   */
  version: varchar({ length: 50 }).notNull(),
  /**
   * 是否强制重新同意 (用于重大更新，true则用户必须再次点击同意)
   */
  isForce: boolean().default(false).notNull(),
  /**
   * 是否展示在登录注册页 (true:展示, false:不展示)
   */
  showInAuth: boolean().default(false).notNull(),
  /**
   * 是否已发布
   */
  isPublished: boolean().default(false).notNull(),
  /**
   * 发布时间
   */
  publishedAt: timestamp({ withTimezone: true, precision: 6 }),
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
   * 同标题与版本唯一约束
   */
  unique("app_agreement_title_version_key").on(table.title, table.version),
  /**
   * 标题与发布状态索引
   */
  index("app_agreement_title_is_published_idx").on(table.title, table.isPublished),
]);

/**
 * 应用协议签署记录表
 */
export const appAgreementLog = pgTable("app_agreement_log", {
  /**
   * 主键ID (使用BigInt防止记录过多)
   */
  id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 用户ID
   */
  userId: integer().notNull(),
  /**
   * 协议ID
   */
  agreementId: integer().notNull(),
  /**
   * 签署时的协议版本快照
   */
  version: varchar({ length: 50 }).notNull(),
  /**
   * 签署时间
   */
  agreedAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  /**
   * 签署IP
   */
  ipAddress: varchar({ length: 45 }),
  /**
   * 设备信息/UserAgent
   */
  deviceInfo: varchar({ length: 500 }),
}, (table) => [
  /**
   * 用户与协议索引
   */
  index("app_agreement_log_user_id_agreement_id_idx").on(table.userId, table.agreementId),
  /**
   * 签署时间索引
   */
  index("app_agreement_log_agreed_at_idx").on(table.agreedAt),
]);

export type AppAgreement = typeof appAgreement.$inferSelect;
export type AppAgreementInsert = typeof appAgreement.$inferInsert;
export type AppAgreementLog = typeof appAgreementLog.$inferSelect;
export type AppAgreementLogInsert = typeof appAgreementLog.$inferInsert;
