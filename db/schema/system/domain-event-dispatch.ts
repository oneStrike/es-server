import { bigint, index, integer, pgTable, timestamp, unique, varchar } from 'drizzle-orm/pg-core'

/**
 * 通用领域事件分发表。
 * 一条领域事件会按 consumer 拆分成多条 dispatch 记录，分别追踪处理状态。
 */
export const domainEventDispatch = pgTable('domain_event_dispatch', {
  id: bigint({ mode: 'bigint' }).primaryKey().generatedAlwaysAsIdentity(),
  eventId: bigint({ mode: 'bigint' }).notNull(),
  consumer: varchar({ length: 40 }).notNull(),
  status: varchar({ length: 24 }).default('pending').notNull(),
  retryCount: integer().default(0).notNull(),
  nextRetryAt: timestamp({ withTimezone: true, precision: 6 }),
  lastError: varchar({ length: 500 }),
  processedAt: timestamp({ withTimezone: true, precision: 6 }),
  createdAt: timestamp({ withTimezone: true, precision: 6 }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true, precision: 6 }).$onUpdate(() => new Date()).notNull(),
}, table => [
  unique('domain_event_dispatch_event_id_consumer_key').on(table.eventId, table.consumer),
  index('domain_event_dispatch_consumer_status_next_retry_at_id_idx').on(
    table.consumer,
    table.status,
    table.nextRetryAt,
    table.id,
  ),
  index('domain_event_dispatch_event_id_idx').on(table.eventId),
])

export type DomainEventDispatchSelect = typeof domainEventDispatch.$inferSelect
export type DomainEventDispatchInsert = typeof domainEventDispatch.$inferInsert
