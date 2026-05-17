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
  uniqueIndex,
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
    /** 面向运营展示的任务主体名称，如作品名；为空表示使用任务类型展示。 */
    displayName: varchar({ length: 180 }),
    /** 操作者类型（1=后台管理员，2=系统）。 */
    operatorType: smallint().notNull(),
    /** 后台管理员操作者 ID；系统任务为空。 */
    operatorUserId: integer(),
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
    /** 活跃任务去重键；同一任务类型下 PENDING/PROCESSING/FINALIZING 期间唯一。 */
    dedupeKey: varchar({ length: 240 }),
    /** 执行期串行键；同一任务类型下 PROCESSING/FINALIZING 期间唯一。 */
    serialKey: varchar({ length: 240 }),
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
    index('background_task_task_type_dedupe_key_idx').on(
      table.taskType,
      table.dedupeKey,
    ),
    index('background_task_task_type_serial_key_status_idx').on(
      table.taskType,
      table.serialKey,
      table.status,
    ),
    uniqueIndex('background_task_task_type_active_dedupe_key_uidx')
      .on(table.taskType, table.dedupeKey)
      .where(
        sql`${table.dedupeKey} is not null and ${table.status} in (1, 2, 3)`,
      ),
    uniqueIndex('background_task_task_type_executing_serial_key_uidx')
      .on(table.taskType, table.serialKey)
      .where(sql`${table.serialKey} is not null and ${table.status} in (2, 3)`),
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
    index('background_task_operator_updated_at_id_idx').on(
      table.operatorType,
      table.operatorUserId,
      table.updatedAt.desc(),
      table.id.desc(),
    ),
    check(
      'background_task_operator_type_valid_chk',
      sql`${table.operatorType} in (1, 2)`,
    ),
    check(
      'background_task_operator_user_id_scope_chk',
      sql`(${table.operatorType} = 1 and ${table.operatorUserId} is not null) or (${table.operatorType} = 2 and ${table.operatorUserId} is null)`,
    ),
    check(
      'background_task_status_valid_chk',
      sql`${table.status} in (1, 2, 3, 4, 5, 6, 7)`,
    ),
    check(
      'background_task_dedupe_key_nonblank_chk',
      sql`${table.dedupeKey} is null or length(trim(${table.dedupeKey})) > 0`,
    ),
    check(
      'background_task_serial_key_nonblank_chk',
      sql`${table.serialKey} is null or length(trim(${table.serialKey})) > 0`,
    ),
    check(
      'background_task_display_name_nonblank_chk',
      sql`${table.displayName} is null or length(trim(${table.displayName})) > 0`,
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

/**
 * 后台任务业务冲突键表。
 * 记录业务层声明的活动 reservation，用于跨任务的同源、同名和同章节互斥。
 */
export const backgroundTaskConflictKey = snakeCase.table(
  'background_task_conflict_key',
  {
    /** 主键 ID。 */
    id: bigint({ mode: 'bigint' }).primaryKey().generatedAlwaysAsIdentity(),
    /** 对外后台任务 ID。 */
    taskId: varchar({ length: 36 }).notNull(),
    /** 任务类型。 */
    taskType: varchar({ length: 120 }).notNull(),
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
    uniqueIndex('background_task_conflict_key_task_type_active_key_uidx')
      .on(table.taskType, table.conflictKey)
      .where(sql`${table.releasedAt} is null`),
    index('background_task_conflict_key_task_id_idx').on(table.taskId),
    index('background_task_conflict_key_task_type_key_idx').on(
      table.taskType,
      table.conflictKey,
    ),
    index('background_task_conflict_key_released_created_at_idx').on(
      table.releasedAt,
      table.createdAt,
    ),
    check(
      'background_task_conflict_key_nonblank_chk',
      sql`length(trim(${table.conflictKey})) > 0`,
    ),
  ],
)

export type BackgroundTaskSelect = typeof backgroundTask.$inferSelect
export type BackgroundTaskInsert = typeof backgroundTask.$inferInsert
export type BackgroundTaskConflictKeySelect =
  typeof backgroundTaskConflictKey.$inferSelect
export type BackgroundTaskConflictKeyInsert =
  typeof backgroundTaskConflictKey.$inferInsert
