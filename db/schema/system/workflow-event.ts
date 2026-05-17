import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  index,
  jsonb,
  smallint,
  snakeCase,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 通用工作流事件表。
 * 事件保持业务无关；领域条目时间线通过领域投影表关联。
 */
export const workflowEvent = snakeCase.table(
  'workflow_event',
  {
    /** 主键 ID。 */
    id: bigint({ mode: 'bigint' }).primaryKey().generatedAlwaysAsIdentity(),
    /** 归属工作流任务内部 ID。 */
    workflowJobId: bigint({ mode: 'bigint' }).notNull(),
    /** 归属 attempt 内部 ID。 */
    workflowAttemptId: bigint({ mode: 'bigint' }),
    /** 事件类型（1=创建草稿，2=确认任务，3=claim attempt，4=心跳，5=进度更新，6=条目成功，7=条目失败，8=attempt 完成，9=请求取消，10=人工重试，11=草稿过期，12=资源清理）。 */
    eventType: smallint().notNull(),
    /** 事件文案。 */
    message: varchar({ length: 500 }).notNull(),
    /** 事件诊断详情。 */
    detail: jsonb(),
    /** 创建时间。 */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('workflow_event_job_created_at_id_idx').on(
      table.workflowJobId,
      table.createdAt,
      table.id,
    ),
    index('workflow_event_attempt_created_at_id_idx').on(
      table.workflowAttemptId,
      table.createdAt,
      table.id,
    ),
    check('workflow_event_type_valid_chk', sql`${table.eventType} in (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)`),
    check('workflow_event_message_nonblank_chk', sql`length(trim(${table.message})) > 0`),
  ],
)

export type WorkflowEventSelect = typeof workflowEvent.$inferSelect
export type WorkflowEventInsert = typeof workflowEvent.$inferInsert
