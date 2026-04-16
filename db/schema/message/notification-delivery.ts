import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  smallint,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 通知 consumer 处理结果表。
 * 记录 notification consumer 对单条 dispatch 的最终业务处理结果。
 */
export const notificationDelivery = pgTable(
  'notification_delivery',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 关联的领域事件 ID。 */
    eventId: bigint({ mode: 'bigint' }).notNull(),
    /** 关联的 dispatch ID。 */
    dispatchId: bigint({ mode: 'bigint' }).notNull(),
    /** 领域事件键。 */
    eventKey: varchar({ length: 120 }).notNull(),
    /** 接收用户 ID。 */
    receiverUserId: integer(),
    /** 通知投影键。 */
    projectionKey: varchar({ length: 180 }),
    /** 通知分类键。 */
    categoryKey: varchar({ length: 80 }),
    /** 关联的站内通知 ID。 */
    notificationId: integer(),
    /** 业务投递状态（1=已投递，2=投递失败，3=重试中，4=因偏好关闭而跳过）。 */
    status: smallint().notNull(),
    /** 命中的模板 ID。 */
    templateId: integer(),
    /** 是否命中启用模板。 */
    usedTemplate: boolean().default(false).notNull(),
    /** 模板回退原因。 */
    fallbackReason: varchar({ length: 64 }),
    /** 最近一次失败原因。 */
    failureReason: varchar({ length: 500 }),
    /** 最近一次投递尝试时间。 */
    lastAttemptAt: timestamp({ withTimezone: true, precision: 6 }).notNull(),
    /** 创建时间。 */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /** 更新时间。 */
    updatedAt: timestamp({ withTimezone: true, precision: 6 })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique('notification_delivery_dispatch_id_key').on(table.dispatchId),
    index('notification_delivery_status_updated_at_idx').on(
      table.status,
      table.updatedAt.desc(),
    ),
    index('notification_delivery_receiver_user_id_updated_at_idx').on(
      table.receiverUserId,
      table.updatedAt.desc(),
    ),
    index('notification_delivery_category_key_status_updated_at_idx').on(
      table.categoryKey,
      table.status,
      table.updatedAt.desc(),
    ),
    index('notification_delivery_event_id_idx').on(table.eventId),
    check(
      'notification_delivery_status_valid_chk',
      sql`${table.status} in (1, 2, 3, 4)`,
    ),
  ],
)

export type NotificationDeliverySelect =
  typeof notificationDelivery.$inferSelect
export type NotificationDeliveryInsert =
  typeof notificationDelivery.$inferInsert
