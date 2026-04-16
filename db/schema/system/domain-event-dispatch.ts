import { sql } from 'drizzle-orm'
import {
  bigint,
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
 * 通用领域事件分发表。
 * 一条领域事件会按 consumer 拆分成多条 dispatch 记录，分别追踪处理状态。
 */
export const domainEventDispatch = pgTable(
  'domain_event_dispatch',
  {
    /** 主键 ID。 */
    id: bigint({ mode: 'bigint' }).primaryKey().generatedAlwaysAsIdentity(),
    /** 关联的领域事件 ID。 */
    eventId: bigint({ mode: 'bigint' }).notNull(),
    /** 消费者标识。 */
    consumer: varchar({ length: 40 }).notNull(),
    /** 处理状态（0=待处理，1=处理中，2=处理成功，3=处理失败）。 */
    status: smallint().default(0).notNull(),
    /** 已重试次数。 */
    retryCount: integer().default(0).notNull(),
    /** 下次允许重试时间。 */
    nextRetryAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 最近一次错误信息。 */
    lastError: varchar({ length: 500 }),
    /** 最终处理完成时间。 */
    processedAt: timestamp({ withTimezone: true, precision: 6 }),
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
    unique('domain_event_dispatch_event_id_consumer_key').on(
      table.eventId,
      table.consumer,
    ),
    index('domain_event_dispatch_consumer_status_next_retry_at_id_idx').on(
      table.consumer,
      table.status,
      table.nextRetryAt,
      table.id,
    ),
    index('domain_event_dispatch_event_id_idx').on(table.eventId),
    check(
      'domain_event_dispatch_status_valid_chk',
      sql`${table.status} in (0, 1, 2, 3)`,
    ),
  ],
)

export type DomainEventDispatchSelect = typeof domainEventDispatch.$inferSelect
export type DomainEventDispatchInsert = typeof domainEventDispatch.$inferInsert
