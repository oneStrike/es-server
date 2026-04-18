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
    /** 任务 ID（task_reminder 场景冗余列，用于对账与查询）。 */
    taskId: integer(),
    /** 任务分配 ID（task_reminder 场景冗余列，用于对账与查询）。 */
    assignmentId: integer(),
    /** 提醒子类型（task_reminder 场景冗余列，用于对账与查询）。 */
    reminderKind: varchar({ length: 40 }),
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
    index('notification_delivery_event_key_updated_at_idx').on(
      table.eventKey,
      table.updatedAt.desc(),
    ),
    index('notification_delivery_receiver_user_id_updated_at_idx').on(
      table.receiverUserId,
      table.updatedAt.desc(),
    ),
    index('notification_delivery_projection_key_idx').on(table.projectionKey),
    index('notification_delivery_category_key_status_updated_at_idx').on(
      table.categoryKey,
      table.status,
      table.updatedAt.desc(),
    ),
    index('notification_delivery_task_lookup_idx').on(
      table.categoryKey,
      table.taskId,
      table.updatedAt.desc(),
      table.id.desc(),
    ),
    index('notification_delivery_assignment_kind_idx').on(
      table.categoryKey,
      table.assignmentId,
      table.reminderKind,
      table.id.desc(),
    ),
    index('notification_delivery_kind_status_assignment_idx').on(
      table.categoryKey,
      table.reminderKind,
      table.status,
      table.assignmentId,
    ),
    index('notification_delivery_event_id_idx').on(table.eventId),
    check(
      'notification_delivery_status_valid_chk',
      sql`${table.status} in (1, 2, 3, 4)`,
    ),
    check(
      'notification_delivery_task_reminder_lookup_required_chk',
      sql`${table.categoryKey} <> 'task_reminder' OR (${table.taskId} IS NOT NULL AND ${table.assignmentId} IS NOT NULL AND ${table.reminderKind} IS NOT NULL)`,
    ),
  ],
)

export type NotificationDeliverySelect =
  typeof notificationDelivery.$inferSelect
export type NotificationDeliveryInsert =
  typeof notificationDelivery.$inferInsert
