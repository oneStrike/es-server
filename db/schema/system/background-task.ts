import { sql } from 'drizzle-orm'
import {
  bigint,
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

/**
 * 通用后台任务表。
 * 仅存储业务无关的任务生命周期、负载、进度、结果、错误和回滚诊断信息。
 */
export const backgroundTask = snakeCase.table(
  'background_task',
  {
    /** 主键 ID。 */
    id: bigint({ mode: 'bigint' }).primaryKey().generatedAlwaysAsIdentity(),
    /** 对外暴露的任务 ID。 */
    taskId: varchar({ length: 36 }).notNull(),
    /** 任务类型，由业务处理器注册。 */
    taskType: varchar({ length: 120 }).notNull(),
    /** 当前任务状态（1=待处理，2=处理中，3=最终写入中，4=成功，5=失败，6=已取消，7=回滚失败）。 */
    status: smallint().notNull(),
    /** 原始任务负载。 */
    payload: jsonb().notNull(),
    /** 任务进度快照。 */
    progress: jsonb().notNull(),
    /** 成功结果。 */
    result: jsonb(),
    /** 失败或取消错误信息。 */
    error: jsonb(),
    /** 处理器记录的待回滚残留信息。 */
    residue: jsonb(),
    /** 回滚失败诊断信息。 */
    rollbackError: jsonb(),
    /** 已重试次数。 */
    retryCount: integer().default(0).notNull(),
    /** 最大允许重试次数。 */
    maxRetries: integer().default(3).notNull(),
    /** 取消请求时间，非空表示运行中任务需要协作取消。 */
    cancelRequestedAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 当前 claim 的 worker 标识。 */
    claimedBy: varchar({ length: 120 }),
    /** 当前 claim 过期时间，仅用于 PROCESSING 回收，不用于 FINALIZING 重放。 */
    claimExpiresAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 开始处理时间。 */
    startedAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 进入最终写入阶段时间。 */
    finalizingAt: timestamp({ withTimezone: true, precision: 6 }),
    /** 任务完成时间。 */
    finishedAt: timestamp({ withTimezone: true, precision: 6 }),
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
    unique('background_task_task_id_key').on(table.taskId),
    index('background_task_task_type_status_created_at_id_idx').on(
      table.taskType,
      table.status,
      table.createdAt,
      table.id,
    ),
    index('background_task_status_created_at_id_idx').on(
      table.status,
      table.createdAt,
      table.id,
    ),
    index('background_task_processing_claim_expires_at_idx').on(
      table.status,
      table.claimExpiresAt,
    ),
    index('background_task_updated_at_id_idx').on(
      table.updatedAt.desc(),
      table.id.desc(),
    ),
    check(
      'background_task_status_valid_chk',
      sql`${table.status} in (1, 2, 3, 4, 5, 6, 7)`,
    ),
    check(
      'background_task_retry_count_non_negative_chk',
      sql`${table.retryCount} >= 0`,
    ),
    check(
      'background_task_max_retries_non_negative_chk',
      sql`${table.maxRetries} >= 0`,
    ),
  ],
)

export type BackgroundTaskSelect = typeof backgroundTask.$inferSelect
export type BackgroundTaskInsert = typeof backgroundTask.$inferInsert
