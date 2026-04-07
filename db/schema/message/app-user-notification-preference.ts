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
} from 'drizzle-orm/pg-core'

/**
 * 通知偏好表
 * 只记录用户对站内通知类型的显式覆盖配置；未写入的类型继续回退到默认策略
 */
export const appUserNotificationPreference = pgTable('app_user_notification_preference', {
  /**
   * 主键 ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 用户 ID
   * 与 app_user 一对多关联，只存当前用户主动调整过的通知类型
   */
  userId: integer().notNull(),
  /**
   * 通知类型
   * 与 MessageNotificationTypeEnum 保持一致，当前第一阶段只按类型维度控制偏好
   */
  notificationType: smallint().notNull(),
  /**
   * 是否启用
   * true / false 仅代表显式覆盖值；若与默认值相同，业务层会删除该行而不是长期保留冗余记录
   */
  isEnabled: boolean().notNull(),
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
   * 用户+通知类型唯一约束
   * 保证显式覆盖配置在同一维度最多只有一条
   */
  unique('app_user_notification_preference_user_id_notification_type_key').on(
    table.userId,
    table.notificationType,
  ),
  /**
   * 用户维度查询索引
   */
  index('app_user_notification_preference_user_id_idx').on(table.userId),
  /**
   * 用户+启用状态索引
   * 便于后续排查某用户的关闭项，不改变当前默认策略口径
   */
  index('app_user_notification_preference_user_id_is_enabled_idx').on(
    table.userId,
    table.isEnabled,
  ),
])

export type AppUserNotificationPreferenceSelect = typeof appUserNotificationPreference.$inferSelect
export type AppUserNotificationPreferenceInsert = typeof appUserNotificationPreference.$inferInsert
