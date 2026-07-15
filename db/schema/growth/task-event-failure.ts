import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  smallint,
  snakeCase,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

import { GROWTH_EVENT_CODE_DOMAIN_SQL } from './growth-event-code-domain'

/**
 * 任务事件消费失败事实。
 *
 * 记录成长事件进入 task consumer 后的失败事实，用于管理端查询与重试补偿。
 */
export const taskEventFailure = snakeCase.table(
  'task_event_failure',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 幂等键，格式为 task:event:{eventKey}:{bizKey}。 */
    idempotencyKey: varchar({ length: 255 }).notNull(),
    /** 成长事件 key。 */
    eventKey: varchar({ length: 80 }).notNull(),
    /** 事件业务幂等键。 */
    eventBizKey: varchar({ length: 180 }).notNull(),
    /** 成长事件编码。 */
    eventCode: smallint().notNull(),
    /** 事件模板 key。 */
    templateKey: varchar({ length: 80 }),
    /** 归属用户 ID。 */
    userId: integer().notNull(),
    /** 目标类型快照。 */
    targetType: varchar({ length: 80 }),
    /** 目标 ID。 */
    targetId: integer(),
    /** 重试状态。1=待重试；2=重试中；3=已解决；4=终态失败。 */
    status: smallint().default(1).notNull(),
    /** 已执行重试次数。 */
    retryCount: integer().default(0).notNull(),
    /** 最近一次重试时间。 */
    lastRetryAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 最近一次失败原因。 */
    lastErrorMessage: varchar({ length: 1000 }),
    /** 解决时间。 */
    resolvedAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 终态失败时间。 */
    terminalErrorAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 终态失败原因。 */
    terminalReason: varchar({ length: 500 }),
    /** 当前处理租约 token。 */
    processingToken: varchar({ length: 64 }),
    /** 当前处理租约开始时间。 */
    processingStartedAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 当前处理租约过期时间。 */
    processingExpiredAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 重放所需事件快照。 */
    requestPayload: jsonb().notNull(),
    /** 事件发生时间。 */
    occurredAt: timestamp({ withTimezone: true, precision: 6 }).notNull(),
    /** 创建时间。 */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /** 最近更新时间。 */
    updatedAt: timestamp({ withTimezone: true, precision: 6 })
      .$onUpdate(() => new Date())
      .notNull(),
    /** 软删除时间。 */
    deletedAt: timestamp({ withTimezone: true, precision: 6 }),
  },
  (table) => [
    unique('task_event_failure_idempotency_key_key').on(table.idempotencyKey),
    index('task_event_failure_status_created_at_idx')
      .on(table.status, table.createdAt.desc(), table.id.desc())
      .where(sql`${table.deletedAt} is null`),
    /**
     * 管理端失败事件按事件键和状态筛选的稳定分页索引。
     */
    index('task_event_failure_event_status_created_at_idx')
      .on(table.eventKey, table.status, table.createdAt.desc(), table.id.desc())
      .where(sql`${table.deletedAt} is null`),
    index('task_event_failure_event_key_biz_key_idx').on(
      table.eventKey,
      table.eventBizKey,
    ),
    index('task_event_failure_user_created_at_idx')
      .on(table.userId, table.createdAt.desc(), table.id.desc())
      .where(sql`${table.deletedAt} is null`),
    check(
      'task_event_failure_idempotency_key_not_blank_chk',
      sql`btrim(${table.idempotencyKey}) <> ''`,
    ),
    check(
      'task_event_failure_event_key_not_blank_chk',
      sql`btrim(${table.eventKey}) <> ''`,
    ),
    check(
      'task_event_failure_event_biz_key_not_blank_chk',
      sql`btrim(${table.eventBizKey}) <> ''`,
    ),
    check(
      'task_event_failure_event_code_valid_chk',
      sql`${table.eventCode} in ${GROWTH_EVENT_CODE_DOMAIN_SQL}`,
    ),
    check(
      'task_event_failure_template_key_not_blank_chk',
      sql`${table.templateKey} is null or btrim(${table.templateKey}) <> ''`,
    ),
    check('task_event_failure_user_id_positive_chk', sql`${table.userId} > 0`),
    check(
      'task_event_failure_target_type_not_blank_chk',
      sql`${table.targetType} is null or btrim(${table.targetType}) <> ''`,
    ),
    check(
      'task_event_failure_target_id_positive_chk',
      sql`${table.targetId} is null or ${table.targetId} > 0`,
    ),
    check(
      'task_event_failure_status_valid_chk',
      sql`${table.status} in (1, 2, 3, 4)`,
    ),
    check(
      'task_event_failure_retry_count_non_negative_chk',
      sql`${table.retryCount} >= 0`,
    ),
    check(
      'task_event_failure_processing_token_not_blank_chk',
      sql`${table.processingToken} is null or btrim(${table.processingToken}) <> ''`,
    ),
    check(
      'task_event_failure_processing_lease_pair_chk',
      sql`(${table.processingToken} is null and ${table.processingStartedAt} is null and ${table.processingExpiredAt} is null) or (${table.processingToken} is not null and ${table.processingStartedAt} is not null and ${table.processingExpiredAt} is not null)`,
    ),
  ],
)

export type TaskEventFailureSelect = typeof taskEventFailure.$inferSelect
export type TaskEventFailureInsert = typeof taskEventFailure.$inferInsert
