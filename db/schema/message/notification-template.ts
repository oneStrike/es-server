/**
 * Auto-converted from legacy schema.
 */

import {
  boolean,
  index,
  integer,
  pgTable,
  smallint,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 通知模板表
 * 为站内通知提供可配置的 title / content 模板，并保留类型到模板键的一对一稳定映射
 */
export const notificationTemplate = pgTable('notification_template', {
  /**
   * 主键 ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 模板唯一键
   * 当前由通知类型推导生成，用于跨环境稳定引用与排障
   */
  templateKey: varchar({ length: 80 }).notNull(),
  /**
   * 通知类型
   * 与 MessageNotificationTypeEnum 保持一致，当前一类通知只允许一份模板
   */
  notificationType: smallint().notNull(),
  /**
   * 标题模板
   * 渲染后需满足 app_user_notification.title 的长度约束
   */
  titleTemplate: varchar({ length: 200 }).notNull(),
  /**
   * 正文模板
   * 渲染后需满足 app_user_notification.content 的长度约束
   */
  contentTemplate: varchar({ length: 1000 }).notNull(),
  /**
   * 是否启用
   * 关闭后通知主链路会自动回退到业务方提供的 fallback 文案
   */
  isEnabled: boolean().default(true).notNull(),
  /**
   * 备注
   * 仅供运营与排障说明使用，不参与渲染
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
   * 模板唯一键约束
   */
  unique('notification_template_template_key_key').on(table.templateKey),
  /**
   * 通知类型唯一约束
   * 确保通知类型到模板键的映射稳定且只有一份启用配置源
   */
  unique('notification_template_notification_type_key').on(table.notificationType),
  /**
   * 通知类型索引
   */
  index('notification_template_notification_type_idx').on(table.notificationType),
  /**
   * 启用状态索引
   */
  index('notification_template_is_enabled_idx').on(table.isEnabled),
  /**
   * 更新时间索引
   */
  index('notification_template_updated_at_idx').on(table.updatedAt),
])

export type NotificationTemplateSelect = typeof notificationTemplate.$inferSelect
export type NotificationTemplateInsert = typeof notificationTemplate.$inferInsert
