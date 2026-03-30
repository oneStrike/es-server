/**
 * Auto-converted from legacy schema.
 */

import {
  bigint,
  index,
  integer,
  pgTable,
  smallint,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 通知投递结果表
 * 为通知域记录 outbox 消费后的业务结果，避免技术消费状态与最终投递结果混淆
 */
export const notificationDelivery = pgTable('notification_delivery', {
  /**
   * 主键 ID
   */
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /**
   * 关联的 outbox 事件 ID
   * 当前采用一条 outbox 对应一条 delivery 记录，并在重试过程中持续更新
   */
  outboxId: bigint({ mode: 'bigint' }).notNull(),
  /**
   * 业务幂等键
   * 与 message_outbox.bizKey 对齐，便于运营和日志按同一键排障
   */
  bizKey: varchar({ length: 180 }).notNull(),
  /**
   * 通知类型
   * 与 MessageNotificationTypeEnum 保持一致；异常数据兼容场景允许为空
   */
  notificationType: smallint(),
  /**
   * 接收用户 ID
   * 从通知 payload 最小解析得到；无效 payload 场景允许为空
   */
  receiverUserId: integer(),
  /**
   * 关联的站内通知 ID
   * 仅在 DELIVERED 场景可回填，跳过或失败场景保持为空
   */
  notificationId: integer(),
  /**
   * 业务投递结果
   * 取值为 DELIVERED / FAILED / RETRYING / SKIPPED_DUPLICATE / SKIPPED_SELF / SKIPPED_PREFERENCE
   */
  status: varchar({ length: 32 }).notNull(),
  /**
   * 当前重试次数
   * 与 message_outbox.retryCount 同步，用于区分初次失败和多次重试
   */
  retryCount: integer().default(0).notNull(),
  /**
   * 最近一次失败原因
   * 仅在 FAILED / RETRYING 场景记录，跳过和成功场景为空
   */
  failureReason: varchar({ length: 500 }),
  /**
   * 最近一次业务投递尝试时间
   * 无论成功、跳过还是失败重试，都会在每次业务结果更新时刷新
   */
  lastAttemptAt: timestamp({ withTimezone: true, precision: 6 }).notNull(),
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
   * outbox 事件唯一约束
   */
  unique('notification_delivery_outbox_id_key').on(table.outboxId),
  /**
   * 结果状态索引
   * 便于按最终业务结果倒序排查
   */
  index('notification_delivery_status_updated_at_idx').on(table.status, table.updatedAt.desc()),
  /**
   * 接收用户维度索引
   */
  index('notification_delivery_receiver_user_id_updated_at_idx').on(
    table.receiverUserId,
    table.updatedAt.desc(),
  ),
  /**
   * 通知类型与结果状态索引
   */
  index('notification_delivery_notification_type_status_updated_at_idx').on(
    table.notificationType,
    table.status,
    table.updatedAt.desc(),
  ),
  /**
   * 业务键索引
   */
  index('notification_delivery_biz_key_idx').on(table.bizKey),
])

export type NotificationDeliverySelect = typeof notificationDelivery.$inferSelect
export type NotificationDeliveryInsert = typeof notificationDelivery.$inferInsert
