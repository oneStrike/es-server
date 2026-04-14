import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 通用领域事件表。
 * 只存放“发生了什么”的事实，不存放按 consumer 拆开的处理状态。
 */
export const domainEvent = pgTable(
  'domain_event',
  {
    /** 主键 ID。 */
    id: bigint({ mode: 'bigint' }).primaryKey().generatedAlwaysAsIdentity(),
    /** 领域事件键。 */
    eventKey: varchar({ length: 120 }).notNull(),
    /** 事件所属业务域。 */
    domain: varchar({ length: 40 }).notNull(),
    /** 事件主体类型。 */
    subjectType: varchar({ length: 40 }).notNull(),
    /** 事件主体 ID。 */
    subjectId: integer().notNull(),
    /** 事件目标类型。 */
    targetType: varchar({ length: 40 }).notNull(),
    /** 事件目标 ID。 */
    targetId: integer().notNull(),
    /** 操作人 ID。 */
    operatorId: integer(),
    /** 事件发生时间。 */
    occurredAt: timestamp({ withTimezone: true, precision: 6 }).notNull(),
    /** 事件上下文。 */
    context: jsonb(),
    /** 创建时间。 */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('domain_event_event_key_created_at_idx').on(
      table.eventKey,
      table.createdAt.desc(),
    ),
    index('domain_event_domain_occurred_at_idx').on(
      table.domain,
      table.occurredAt.desc(),
    ),
    index('domain_event_subject_type_subject_id_idx').on(
      table.subjectType,
      table.subjectId,
    ),
    index('domain_event_target_type_target_id_idx').on(
      table.targetType,
      table.targetId,
    ),
  ],
)

export type DomainEventSelect = typeof domainEvent.$inferSelect
export type DomainEventInsert = typeof domainEvent.$inferInsert
