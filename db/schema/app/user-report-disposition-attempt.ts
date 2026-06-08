import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  smallint,
  snakeCase,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * 举报目标处置尝试记录。
 * 仅记录 owner 处置执行失败和后续重试恢复证据；最终成功结果写回 user_report。
 */
export const userReportDispositionAttempt = snakeCase.table(
  'user_report_disposition_attempt',
  {
    /** 主键 ID。 */
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** 举报 ID。 */
    reportId: integer().notNull(),
    /** 本次尝试的目标处置动作。 */
    targetAction: smallint().notNull(),
    /** 尝试状态（1=失败，2=重试已成功）。 */
    attemptStatus: smallint().notNull(),
    /** 失败码。 */
    failureCode: varchar({ length: 120 }),
    /** 失败信息。 */
    failureMessage: varchar({ length: 500 }),
    /** 是否可重试。 */
    retryable: boolean().default(true).notNull(),
    /** 操作管理员 ID。 */
    actorUserId: integer().notNull(),
    /** 尝试发生时间。 */
    attemptedAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /** 被重试成功解决的时间。 */
    resolvedAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 结构化结果或诊断。 */
    result: jsonb(),
    /** 创建时间。 */
    createdAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    /** 更新时间。 */
    updatedAt: timestamp({ withTimezone: true, precision: 6 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('user_report_disposition_attempt_report_created_at_idx').on(
      table.reportId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index('user_report_disposition_attempt_status_created_at_idx').on(
      table.attemptStatus,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index('user_report_disposition_attempt_failed_latest_idx')
      .on(table.reportId, table.createdAt.desc(), table.id.desc())
      .where(sql`${table.attemptStatus} = 1 and ${table.resolvedAt} is null`),
    check(
      'user_report_disposition_attempt_action_valid_chk',
      sql`${table.targetAction} in (1, 2, 3, 4, 5, 6, 7)`,
    ),
    check(
      'user_report_disposition_attempt_status_valid_chk',
      sql`${table.attemptStatus} in (1, 2)`,
    ),
  ],
)

export type UserReportDispositionAttemptSelect =
  typeof userReportDispositionAttempt.$inferSelect
export type UserReportDispositionAttemptInsert =
  typeof userReportDispositionAttempt.$inferInsert
