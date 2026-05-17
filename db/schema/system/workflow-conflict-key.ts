import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  index,
  snakeCase,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 工作流业务冲突键表。
 * 记录活动任务占用的业务范围，并保留同任务重试时重新占用所需的历史 key。
 */
export const workflowConflictKey = snakeCase.table(
  'workflow_conflict_key',
  {
    /** 主键 ID。 */
    id: bigint({ mode: 'bigint' }).primaryKey().generatedAlwaysAsIdentity(),
    /** 归属工作流任务内部 ID。 */
    workflowJobId: bigint({ mode: 'bigint' }).notNull(),
    /** 工作流类型。 */
    workflowType: varchar({ length: 120 }).notNull(),
    /** 业务冲突键。 */
    conflictKey: varchar({ length: 300 }).notNull(),
    /** 释放时间；为空表示仍然占用。 */
    releasedAt: timestamp({ withTimezone: true, precision: 6 }),
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
    uniqueIndex('workflow_conflict_key_workflow_type_active_key_uidx')
      .on(table.workflowType, table.conflictKey)
      .where(sql`${table.releasedAt} is null`),
    index('workflow_conflict_key_job_id_idx').on(table.workflowJobId),
    index('workflow_conflict_key_workflow_type_key_idx').on(
      table.workflowType,
      table.conflictKey,
    ),
    index('workflow_conflict_key_released_created_at_idx').on(
      table.releasedAt,
      table.createdAt,
    ),
    check('workflow_conflict_key_workflow_type_nonblank_chk', sql`length(trim(${table.workflowType})) > 0`),
    check('workflow_conflict_key_nonblank_chk', sql`length(trim(${table.conflictKey})) > 0`),
  ],
)

export type WorkflowConflictKeySelect = typeof workflowConflictKey.$inferSelect
export type WorkflowConflictKeyInsert = typeof workflowConflictKey.$inferInsert
