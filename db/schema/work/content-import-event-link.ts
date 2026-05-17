import { bigint, index, snakeCase, unique } from 'drizzle-orm/pg-core'

/**
 * 内容导入事件投影表。
 * 将通用 workflow_event 映射到内容导入任务、条目与条目 attempt。
 */
export const contentImportEventLink = snakeCase.table(
  'content_import_event_link',
  {
    /** 主键 ID。 */
    id: bigint({ mode: 'bigint' }).primaryKey().generatedAlwaysAsIdentity(),
    /** 工作流事件内部 ID。 */
    workflowEventId: bigint({ mode: 'bigint' }).notNull(),
    /** 内容导入任务内部 ID。 */
    contentImportJobId: bigint({ mode: 'bigint' }).notNull(),
    /** 内容导入条目内部 ID。 */
    contentImportItemId: bigint({ mode: 'bigint' }),
    /** 内容导入条目 attempt 内部 ID。 */
    contentImportItemAttemptId: bigint({ mode: 'bigint' }),
  },
  (table) => [
    unique('content_import_event_link_workflow_event_id_key').on(
      table.workflowEventId,
    ),
    index('content_import_event_link_job_idx').on(table.contentImportJobId),
    index('content_import_event_link_item_idx').on(table.contentImportItemId),
    index('content_import_event_link_item_attempt_idx').on(
      table.contentImportItemAttemptId,
    ),
  ],
)

export type ContentImportEventLinkSelect =
  typeof contentImportEventLink.$inferSelect
export type ContentImportEventLinkInsert =
  typeof contentImportEventLink.$inferInsert
