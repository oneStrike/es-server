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
    id: bigint({ mode: 'bigint' }).primaryKey().generatedAlwaysAsIdentity(),
    eventKey: varchar({ length: 120 }).notNull(),
    domain: varchar({ length: 40 }).notNull(),
    subjectType: varchar({ length: 40 }).notNull(),
    subjectId: integer().notNull(),
    targetType: varchar({ length: 40 }).notNull(),
    targetId: integer().notNull(),
    operatorId: integer(),
    occurredAt: timestamp({ withTimezone: true, precision: 6 }).notNull(),
    context: jsonb(),
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
