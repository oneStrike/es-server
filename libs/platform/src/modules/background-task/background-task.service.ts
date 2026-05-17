import type { BackgroundTaskSelect } from '@db/schema'
import type { Db } from '@db/core'
import type { PostgresErrorSource } from '@db/core'
import type { SQL } from 'drizzle-orm'
import type { BusinessExceptionCause } from '@libs/platform/exceptions'
import type {
  BackgroundTaskExecutionContext,
  BackgroundTaskHandler,
  BackgroundTaskObject,
  BackgroundTaskProgress,
  BackgroundTaskProgressReporter,
  BackgroundTaskProgressReporterOptions,
  CreateBackgroundTaskInput,
} from './types'
import type { BackgroundTaskExecutionLease } from './types/background-task-execution-lease.type'
import type { BackgroundTaskNotificationSelect } from './types/background-task-notification.type'
import { randomUUID } from 'node:crypto'
import { DrizzleService, PostgresErrorCode } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { getAppTimeZone } from '@libs/platform/utils'
import { Injectable, Logger } from '@nestjs/common'
import dayjs from 'dayjs'
import { and, asc, eq, gte, inArray, isNull, lte, ne, or } from 'drizzle-orm'
import {
  BACKGROUND_TASK_CLAIM_RENEW_INTERVAL_SECONDS,
  BACKGROUND_TASK_CLAIM_TIMEOUT_SECONDS,
  BACKGROUND_TASK_DEFAULT_MAX_RETRY,
  BACKGROUND_TASK_INITIAL_PROGRESS,
  BACKGROUND_TASK_RETRYABLE_STATUSES,
  BACKGROUND_TASK_WORKER_BATCH_SIZE,
  BackgroundTaskOperatorTypeEnum,
  BackgroundTaskStatusEnum,
} from './background-task.constant'
import { BackgroundTaskRegistry } from './background-task.registry'
import { BackgroundTaskIdDto, BackgroundTaskPageRequestDto } from './dto'

class BackgroundTaskCancellationError extends Error {
  constructor() {
    super('后台任务已请求取消')
    this.name = 'BackgroundTaskCancellationError'
  }
}

class BackgroundTaskFinalizingExpiredError extends Error {
  constructor() {
    super('后台任务在最终写入阶段超时，已进入恢复回滚')
    this.name = 'BackgroundTaskFinalizingExpiredError'
  }
}

export class BackgroundTaskClaimLostError extends Error {
  constructor() {
    super('后台任务 claim 已丢失')
    this.name = 'BackgroundTaskClaimLostError'
  }
}

const BACKGROUND_TASK_CONSTRAINT = {
  taskId: 'background_task_task_id_key',
  dedupeKey: 'background_task_task_type_active_dedupe_key_uidx',
  serialKey: 'background_task_task_type_executing_serial_key_uidx',
  conflictKey: 'background_task_conflict_key_task_type_active_key_uidx',
} as const

const BACKGROUND_TASK_EXECUTING_SERIAL_STATUSES = [
  BackgroundTaskStatusEnum.PROCESSING,
  BackgroundTaskStatusEnum.FINALIZING,
] as const

const BACKGROUND_TASK_RESERVATION_KEY_MAX_LENGTH = 240
const BACKGROUND_TASK_CONFLICT_KEY_MAX_LENGTH = 300

interface NormalizedTaskReservation {
  dedupeKey: string | null
  dedupeConflictMessage?: string
  serialKey: string | null
  conflictKeys: string[]
  conflictMessageByKey: Map<string, string>
}

/**
 * 通用后台任务服务。
 * 负责持久化状态机、claim、取消、重试、执行和失败补偿，不持有具体业务逻辑。
 */
@Injectable()
export class BackgroundTaskService {
  private readonly logger = new Logger(BackgroundTaskService.name)
  private readonly maxErrorCauseDepth = 3
  private readonly maxErrorCauseArrayLength = 10
  private readonly maxErrorCauseObjectKeys = 20
  private readonly maxErrorCauseStringLength = 500
  private readonly claimScanLimit = Math.max(
    BACKGROUND_TASK_WORKER_BATCH_SIZE * 4,
    20,
  )

  // 初始化后台任务服务依赖。
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly registry: BackgroundTaskRegistry,
  ) {}

  // 读取 db。
  private get db() {
    return this.drizzle.db
  }

  // 读取 backgroundTask 表。
  private get backgroundTask() {
    return this.drizzle.schema.backgroundTask
  }

  // 读取 backgroundTaskConflictKey 表。
  private get backgroundTaskConflictKey() {
    return this.drizzle.schema.backgroundTaskConflictKey
  }

  // 使用底层事务包住多表写入；测试替身没有 transaction 时退化为直接执行。
  private async runInDbTransaction<T>(callback: (tx: Db) => Promise<T>) {
    const transaction = (
      this.db as Db & {
        transaction?: <TResult>(
          transactionCallback: (tx: Db) => Promise<TResult>,
        ) => Promise<TResult>
      }
    ).transaction

    if (typeof transaction === 'function') {
      return transaction.call(this.db, callback)
    }

    return callback(this.db)
  }

  // 创建待处理后台任务，只入队不执行任何业务处理器。
  async createTask(input: CreateBackgroundTaskInput) {
    return this.runInDbTransaction((tx) => this.createTaskWithDb(input, tx))
  }

  // 在调用方事务内创建后台任务，供业务先拿事务锁再入队。
  async createTaskInTransaction(input: CreateBackgroundTaskInput, tx: Db) {
    return this.createTaskWithDb(input, tx)
  }

  // 使用指定 db/tx 写入任务，确保普通入队和事务内入队复用同一校验与落库语义。
  private async createTaskWithDb(input: CreateBackgroundTaskInput, db: Db) {
    const operator = this.normalizeTaskOperator(input.operator)
    const reservation = this.normalizeTaskReservation(input)
    if (!this.registry.has(input.taskType)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `后台任务处理器不存在: ${input.taskType}`,
      )
    }

    const now = new Date()
    try {
      const [row] = await db
        .insert(this.backgroundTask)
        .values({
          taskId: randomUUID(),
          taskType: input.taskType,
          operatorType: operator.operatorType,
          operatorUserId: operator.operatorUserId,
          status: BackgroundTaskStatusEnum.PENDING,
          payload: input.payload,
          progress: BACKGROUND_TASK_INITIAL_PROGRESS,
          result: null,
          error: null,
          residue: null,
          rollbackError: null,
          dedupeKey: reservation.dedupeKey,
          serialKey: reservation.serialKey,
          retryCount: 0,
          maxRetries: input.maxRetries ?? BACKGROUND_TASK_DEFAULT_MAX_RETRY,
          cancelRequestedAt: null,
          claimedBy: null,
          claimExpiresAt: null,
          startedAt: null,
          finalizingAt: null,
          finishedAt: null,
          createdAt: now,
          updatedAt: now,
        })
        .returning()

      for (const conflictKey of reservation.conflictKeys) {
        await db.insert(this.backgroundTaskConflictKey).values({
          taskId: row.taskId,
          taskType: row.taskType,
          conflictKey,
          releasedAt: null,
          createdAt: now,
          updatedAt: now,
        })
      }

      return this.toTaskDto(row)
    } catch (error) {
      this.handleCreateTaskReservationError(error, reservation)
    }
  }

  // 归一化后台任务操作者，确保写库前满足 schema scope 约束。
  private normalizeTaskOperator(
    operator: CreateBackgroundTaskInput['operator'],
  ) {
    if (!operator) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '后台任务创建必须声明操作者',
      )
    }

    if (operator.type === BackgroundTaskOperatorTypeEnum.ADMIN) {
      if (!Number.isInteger(operator.userId) || operator.userId <= 0) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '后台任务管理员操作者ID非法',
        )
      }
      return {
        operatorType: BackgroundTaskOperatorTypeEnum.ADMIN,
        operatorUserId: operator.userId,
      }
    }

    if (operator.type === BackgroundTaskOperatorTypeEnum.SYSTEM) {
      return {
        operatorType: BackgroundTaskOperatorTypeEnum.SYSTEM,
        operatorUserId: null,
      }
    }

    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '后台任务操作者类型非法',
    )
  }

  // 归一化 reservation 入参，保持平台层只处理通用 key，不写入业务文案。
  private normalizeTaskReservation(
    input: CreateBackgroundTaskInput,
  ): NormalizedTaskReservation {
    const conflictMessageByKey = new Map<string, string>()
    for (const [key, message] of Object.entries(
      input.conflictMessageByKey ?? {},
    )) {
      const normalizedKey = this.normalizeRequiredReservationKey(
        key,
        BACKGROUND_TASK_CONFLICT_KEY_MAX_LENGTH,
        '后台任务冲突键',
      )
      if (message.trim()) {
        conflictMessageByKey.set(normalizedKey, message)
      }
    }

    return {
      dedupeKey: this.normalizeOptionalReservationKey(
        input.dedupeKey,
        BACKGROUND_TASK_RESERVATION_KEY_MAX_LENGTH,
        '后台任务去重键',
      ),
      dedupeConflictMessage: input.dedupeConflictMessage?.trim() || undefined,
      serialKey: this.normalizeOptionalReservationKey(
        input.serialKey,
        BACKGROUND_TASK_RESERVATION_KEY_MAX_LENGTH,
        '后台任务串行键',
      ),
      conflictKeys: this.normalizeConflictKeys(input.conflictKeys),
      conflictMessageByKey,
    }
  }

  // 归一化可选 reservation key；缺省保持为空，显式空白视为调用方错误。
  private normalizeOptionalReservationKey(
    value: string | undefined,
    maxLength: number,
    label: string,
  ) {
    if (value === undefined) {
      return null
    }
    return this.normalizeRequiredReservationKey(value, maxLength, label)
  }

  // 归一化必填 reservation key。
  private normalizeRequiredReservationKey(
    value: string,
    maxLength: number,
    label: string,
  ) {
    const normalizedValue = value.trim()
    if (!normalizedValue) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `${label}不能为空`,
      )
    }
    if (normalizedValue.length > maxLength) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `${label}长度不能超过 ${maxLength}`,
      )
    }
    return normalizedValue
  }

  // 去重并校验业务冲突键，保证同一任务不会重复占用相同 key。
  private normalizeConflictKeys(keys: string[] | undefined) {
    const normalizedKeys: string[] = []
    const seenKeys = new Set<string>()
    for (const key of keys ?? []) {
      const normalizedKey = this.normalizeRequiredReservationKey(
        key,
        BACKGROUND_TASK_CONFLICT_KEY_MAX_LENGTH,
        '后台任务冲突键',
      )
      if (seenKeys.has(normalizedKey)) {
        continue
      }
      seenKeys.add(normalizedKey)
      normalizedKeys.push(normalizedKey)
    }
    return normalizedKeys
  }

  // 将创建任务期间的 reservation 唯一冲突翻译为调用方声明的业务文案。
  private handleCreateTaskReservationError(
    error: unknown,
    reservation: NormalizedTaskReservation,
  ): never {
    const postgresError = this.extractPostgresError(error)
    if (
      postgresError?.code === PostgresErrorCode.UNIQUE_VIOLATION &&
      postgresError.constraint === BACKGROUND_TASK_CONSTRAINT.taskId
    ) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
        '后台任务ID已存在',
        { cause: this.toBusinessExceptionCause(error) },
      )
    }

    if (
      postgresError?.code === PostgresErrorCode.UNIQUE_VIOLATION &&
      postgresError.constraint === BACKGROUND_TASK_CONSTRAINT.dedupeKey
    ) {
      if (reservation.dedupeConflictMessage) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
          reservation.dedupeConflictMessage,
          { cause: this.toBusinessExceptionCause(error) },
        )
      }
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '后台任务去重键已被占用，请刷新后重试',
        { cause: this.toBusinessExceptionCause(error) },
      )
    }

    if (
      postgresError?.code === PostgresErrorCode.UNIQUE_VIOLATION &&
      postgresError.constraint === BACKGROUND_TASK_CONSTRAINT.conflictKey
    ) {
      const conflictKey = this.extractConflictKeyFromPostgresDetail(
        postgresError.detail,
      )
      const message = conflictKey
        ? reservation.conflictMessageByKey.get(conflictKey)
        : undefined
      if (message) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
          message,
          { cause: this.toBusinessExceptionCause(error) },
        )
      }
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '后台任务冲突键已被占用，请刷新后重试',
        { cause: this.toBusinessExceptionCause(error) },
      )
    }

    this.handleDatabaseError(error, { duplicate: '后台任务ID已存在' })
  }

  // 将重试时重新占用 reservation 的唯一冲突翻译为稳定状态冲突。
  private handleRetryReservationError(error: unknown): never {
    if (
      this.isConstraintViolation(error, BACKGROUND_TASK_CONSTRAINT.dedupeKey) ||
      this.isConstraintViolation(error, BACKGROUND_TASK_CONSTRAINT.conflictKey)
    ) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '任务 reservation 已被其他任务占用，请重新提交任务',
        { cause: this.toBusinessExceptionCause(error) },
      )
    }

    this.handleDatabaseError(error, {
      conflict: '任务状态已变化，请刷新后重试',
    })
  }

  // 判断异常是否来自指定 PostgreSQL 唯一约束。
  private isConstraintViolation(error: unknown, constraint: string) {
    const postgresError = this.extractPostgresError(error)
    return (
      postgresError?.code === PostgresErrorCode.UNIQUE_VIOLATION &&
      postgresError.constraint === constraint
    )
  }

  // 从 PostgreSQL 唯一冲突 detail 中提取 conflict_key，供逐 key 文案映射使用。
  private extractConflictKeyFromPostgresDetail(detail: string | undefined) {
    if (!detail) {
      return undefined
    }
    const match =
      /Key \((?:[^)]*,\s*)?conflict_key\)=\((?:[^,]*,\s*)?(.+)\) already exists/.exec(
        detail,
      )
    return match?.[1]
  }

  // 从未知异常中提取 PostgreSQL 元信息。
  private extractPostgresError(error: unknown) {
    const source =
      error instanceof Error || (typeof error === 'object' && error !== null)
        ? error
        : undefined
    return this.drizzle.extractError(source as PostgresErrorSource)
  }

  // 统一透传数据库异常翻译，同时允许调用点提供局部文案。
  private handleDatabaseError(
    error: unknown,
    messages: Parameters<DrizzleService['handleError']>[1],
  ): never {
    const source =
      error instanceof Error || (typeof error === 'object' && error !== null)
        ? error
        : undefined
    this.drizzle.handleError(source as PostgresErrorSource, messages)
  }

  // 将 unknown 收敛为 BusinessException 支持的 cause 类型。
  private toBusinessExceptionCause(
    error: unknown,
  ): BusinessExceptionCause | undefined {
    if (
      error instanceof Error ||
      typeof error === 'string' ||
      typeof error === 'number' ||
      typeof error === 'boolean' ||
      error === null
    ) {
      return error
    }
    if (typeof error === 'object') {
      return error as Record<string, unknown>
    }
    return undefined
  }

  // 分页查询后台任务。
  async getTaskPage(input: BackgroundTaskPageRequestDto) {
    const conditions = this.buildTaskPageConditions(input)
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const page = await this.drizzle.ext.findPagination(this.backgroundTask, {
      where,
      pageIndex: input.pageIndex,
      pageSize: input.pageSize,
      orderBy: input.orderBy?.trim()
        ? input.orderBy
        : { createdAt: 'desc', id: 'desc' },
    })

    return {
      ...page,
      list: page.list.map((row) => this.toTaskDto(row)),
    }
  }

  // 分页查询当前后台管理员的轻量后台任务通知。
  async getMyTaskPage(input: BackgroundTaskPageRequestDto, userId: number) {
    const conditions = this.buildTaskPageConditions(input)
    conditions.push(
      eq(
        this.backgroundTask.operatorType,
        BackgroundTaskOperatorTypeEnum.ADMIN,
      ),
      eq(this.backgroundTask.operatorUserId, userId),
    )
    const page = await this.drizzle.ext.findPagination(this.backgroundTask, {
      where: and(...conditions),
      pageIndex: input.pageIndex,
      pageSize: input.pageSize,
      orderBy: input.orderBy?.trim()
        ? input.orderBy
        : { updatedAt: 'desc', id: 'desc' },
      pick: ['taskId', 'taskType', 'status', 'progress', 'updatedAt'] as const,
    })

    return {
      ...page,
      list: page.list.map((row) => this.toTaskNotificationDto(row)),
    }
  }

  // 构建后台任务分页通用筛选条件。
  private buildTaskPageConditions(input: BackgroundTaskPageRequestDto) {
    const conditions: SQL[] = []
    if (input.taskId) {
      conditions.push(eq(this.backgroundTask.taskId, input.taskId))
    }
    if (input.taskType) {
      conditions.push(eq(this.backgroundTask.taskType, input.taskType))
    }
    if (input.status !== undefined) {
      conditions.push(eq(this.backgroundTask.status, input.status))
    }
    const startDate = this.parseCreatedAtFilter(input.startDate, 'start')
    if (startDate) {
      conditions.push(gte(this.backgroundTask.createdAt, startDate))
    }
    const endDate = this.parseCreatedAtFilter(input.endDate, 'end')
    if (endDate) {
      conditions.push(lte(this.backgroundTask.createdAt, endDate))
    }

    return conditions
  }

  // 查询后台任务详情。
  async getTaskDetail(input: BackgroundTaskIdDto) {
    return this.toTaskDto(await this.readTask(input.taskId))
  }

  // 请求取消后台任务，pending 任务可立即取消，运行中任务由处理器协作检查后回滚。
  async cancelTask(input: BackgroundTaskIdDto) {
    const row = await this.readTask(input.taskId)
    const now = new Date()

    if (row.status === BackgroundTaskStatusEnum.PENDING) {
      const cancelled = await this.runInDbTransaction(async (tx) => {
        const [cancelledRow] = await tx
          .update(this.backgroundTask)
          .set({
            status: BackgroundTaskStatusEnum.CANCELLED,
            cancelRequestedAt: now,
            error: this.toErrorObject(new BackgroundTaskCancellationError()),
            finishedAt: now,
            claimedBy: null,
            claimExpiresAt: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(this.backgroundTask.taskId, input.taskId),
              eq(this.backgroundTask.status, BackgroundTaskStatusEnum.PENDING),
            ),
          )
          .returning()

        if (cancelledRow) {
          await this.releaseConflictKeys(cancelledRow.taskId, tx, now)
        }

        return cancelledRow
      })
      return this.toTaskDto(cancelled ?? (await this.readTask(input.taskId)))
    }

    if (
      row.status === BackgroundTaskStatusEnum.PROCESSING ||
      row.status === BackgroundTaskStatusEnum.FINALIZING
    ) {
      const [cancelRequested] = await this.db
        .update(this.backgroundTask)
        .set({
          cancelRequestedAt: row.cancelRequestedAt ?? now,
          updatedAt: now,
        })
        .where(eq(this.backgroundTask.taskId, input.taskId))
        .returning()
      return this.toTaskDto(cancelRequested)
    }

    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '当前任务状态不允许取消',
    )
  }

  // 重试已清洁失败或已清洁取消的任务。
  async retryTask(input: BackgroundTaskIdDto) {
    const row = await this.readTask(input.taskId)
    if (!BACKGROUND_TASK_RETRYABLE_STATUSES.includes(row.status as never)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '当前任务状态不允许重试',
      )
    }
    if (row.rollbackError) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '任务回滚失败，清理完成前不允许重试',
      )
    }
    if (row.retryCount >= row.maxRetries) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '任务已达到最大重试次数',
      )
    }

    const conflictKeys = await this.readConflictKeys(row.taskId)
    const handler = this.registry.resolve(row.taskType)
    await handler.validateRetry?.({
      taskId: row.taskId,
      taskType: row.taskType,
      payload: this.asObject(row.payload),
      residue: this.asObject(row.residue),
      status: this.normalizeStatus(row.status),
      retryCount: row.retryCount,
      dedupeKey: row.dedupeKey,
      serialKey: row.serialKey,
      conflictKeys,
    })

    const now = new Date()
    let retried: BackgroundTaskSelect | undefined
    try {
      retried = await this.runInDbTransaction(async (tx) => {
        const [retriedRow] = await tx
          .update(this.backgroundTask)
          .set({
            status: BackgroundTaskStatusEnum.PENDING,
            progress: BACKGROUND_TASK_INITIAL_PROGRESS,
            result: null,
            error: null,
            residue: null,
            rollbackError: null,
            retryCount: row.retryCount + 1,
            cancelRequestedAt: null,
            claimedBy: null,
            claimExpiresAt: null,
            startedAt: null,
            finalizingAt: null,
            finishedAt: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(this.backgroundTask.taskId, input.taskId),
              or(
                eq(this.backgroundTask.status, BackgroundTaskStatusEnum.FAILED),
                eq(
                  this.backgroundTask.status,
                  BackgroundTaskStatusEnum.CANCELLED,
                ),
              ),
              isNull(this.backgroundTask.rollbackError),
            ),
          )
          .returning()

        if (retriedRow) {
          await this.reactivateConflictKeys(retriedRow.taskId, tx, now)
        }

        return retriedRow
      })
    } catch (error) {
      this.handleRetryReservationError(error)
    }

    if (!retried) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '任务状态已变化，请刷新后重试',
      )
    }
    return this.toTaskDto(retried)
  }

  // 消费一轮待处理任务。
  async consumePendingTasks(workerId = `worker-${randomUUID()}`) {
    for (let index = 0; index < BACKGROUND_TASK_WORKER_BATCH_SIZE; index += 1) {
      const row = await this.claimNextTask(workerId)
      if (!row) {
        break
      }
      await this.executeClaimedTask(row)
    }
  }

  // 原子 claim 一个可执行任务；过期 FINALIZING 会被回收并进入恢复回滚。
  async claimNextTask(workerId: string) {
    const now = new Date()
    const candidates = await this.db
      .select()
      .from(this.backgroundTask)
      .where(
        or(
          eq(this.backgroundTask.status, BackgroundTaskStatusEnum.PENDING),
          and(
            eq(this.backgroundTask.status, BackgroundTaskStatusEnum.PROCESSING),
            lte(this.backgroundTask.claimExpiresAt, now),
          ),
          and(
            eq(this.backgroundTask.status, BackgroundTaskStatusEnum.FINALIZING),
            lte(this.backgroundTask.claimExpiresAt, now),
          ),
        ),
      )
      .orderBy(asc(this.backgroundTask.createdAt), asc(this.backgroundTask.id))
      .limit(this.claimScanLimit)

    for (const candidate of candidates) {
      if (
        candidate.status === BackgroundTaskStatusEnum.PENDING &&
        candidate.serialKey &&
        (await this.hasBusySerialTask(candidate))
      ) {
        continue
      }

      try {
        const claimed = await this.claimTaskCandidate(candidate, workerId, now)
        if (claimed) {
          return claimed
        }
      } catch (error) {
        if (
          this.isConstraintViolation(
            error,
            BACKGROUND_TASK_CONSTRAINT.serialKey,
          )
        ) {
          continue
        }
        throw error
      }
    }

    return null
  }

  // 检查同任务类型的串行键是否已有执行中任务。
  private async hasBusySerialTask(candidate: BackgroundTaskSelect) {
    if (!candidate.serialKey) {
      return false
    }

    const [busyTask] = await this.db
      .select({ id: this.backgroundTask.id })
      .from(this.backgroundTask)
      .where(
        and(
          eq(this.backgroundTask.taskType, candidate.taskType),
          eq(this.backgroundTask.serialKey, candidate.serialKey),
          inArray(
            this.backgroundTask.status,
            BACKGROUND_TASK_EXECUTING_SERIAL_STATUSES,
          ),
          ne(this.backgroundTask.id, candidate.id),
        ),
      )
      .limit(1)

    return busyTask !== undefined
  }

  // 尝试 claim 指定候选任务。
  private async claimTaskCandidate(
    candidate: BackgroundTaskSelect,
    workerId: string,
    now: Date,
  ) {
    const deadline = this.buildClaimDeadline(now)
    const [claimed] = await this.db
      .update(this.backgroundTask)
      .set({
        status:
          candidate.status === BackgroundTaskStatusEnum.FINALIZING
            ? BackgroundTaskStatusEnum.FINALIZING
            : BackgroundTaskStatusEnum.PROCESSING,
        claimedBy: workerId,
        claimExpiresAt: deadline,
        startedAt: candidate.startedAt ?? now,
        finalizingAt:
          candidate.status === BackgroundTaskStatusEnum.FINALIZING
            ? (candidate.finalizingAt ?? candidate.updatedAt ?? now)
            : null,
        finishedAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(this.backgroundTask.id, candidate.id),
          or(
            eq(this.backgroundTask.status, BackgroundTaskStatusEnum.PENDING),
            and(
              eq(
                this.backgroundTask.status,
                BackgroundTaskStatusEnum.PROCESSING,
              ),
              lte(this.backgroundTask.claimExpiresAt, now),
            ),
            and(
              eq(
                this.backgroundTask.status,
                BackgroundTaskStatusEnum.FINALIZING,
              ),
              lte(this.backgroundTask.claimExpiresAt, now),
            ),
          ),
        ),
      )
      .returning()

    return claimed ?? null
  }

  // 执行已 claim 任务，并在执行期间持续续租当前 worker 的 claim。
  async executeClaimedTask(row: BackgroundTaskSelect) {
    const handler = this.registry.resolve(row.taskType)
    const ownerWorkerId = row.claimedBy
    if (!ownerWorkerId) {
      throw new BackgroundTaskClaimLostError()
    }
    const lease: BackgroundTaskExecutionLease = {
      taskId: row.taskId,
      ownerWorkerId,
      claimLost: false,
    }
    const stopHeartbeat = this.startClaimHeartbeat(lease)
    const context = this.buildExecutionContext(row, lease)
    let prepared: unknown

    try {
      if (row.status === BackgroundTaskStatusEnum.FINALIZING) {
        throw new BackgroundTaskFinalizingExpiredError()
      }
      prepared = await handler.prepare?.(context)
      await context.assertNotCancelled()
      await this.markTaskFinalizing(row.taskId, ownerWorkerId)
      await context.assertNotCancelled()
      const result = await handler.finalize(context, prepared)
      await this.markTaskSucceeded(row.taskId, ownerWorkerId, result)
    } catch (error) {
      await this.rollbackUnsuccessfulTask(row, handler, context, error)
    } finally {
      stopHeartbeat()
    }
  }

  // 更新任务进度。
  async updateProgress(taskId: string, progress: BackgroundTaskProgress) {
    const now = new Date()
    await this.db
      .update(this.backgroundTask)
      .set({
        claimExpiresAt: this.buildClaimDeadline(now),
        progress,
        updatedAt: now,
      })
      .where(eq(this.backgroundTask.taskId, taskId))
  }

  // 以当前 owner 身份更新任务进度；失去 claim 时中断旧 worker。
  private async updateProgressForOwner(
    lease: BackgroundTaskExecutionLease,
    progress: BackgroundTaskProgress,
  ) {
    this.assertLeaseNotLost(lease)
    const now = new Date()
    const [row] = await this.db
      .update(this.backgroundTask)
      .set({
        claimExpiresAt: this.buildClaimDeadline(now),
        progress,
        updatedAt: now,
      })
      .where(this.buildOwnerRunningWhere(lease))
      .returning()
    this.assertOwnerWriteMatched(row, lease)
  }

  // 合并记录任务残留，供处理器补偿时定位业务副作用。
  async recordResidue(taskId: string, residue: BackgroundTaskObject) {
    const row = await this.readTask(taskId)
    const mergedResidue = {
      ...this.asObject(row.residue),
      ...residue,
    }
    const now = new Date()
    await this.db
      .update(this.backgroundTask)
      .set({
        claimExpiresAt: this.shouldExtendClaim(row.status)
          ? this.buildClaimDeadline(now)
          : row.claimExpiresAt,
        residue: mergedResidue,
        updatedAt: now,
      })
      .where(eq(this.backgroundTask.taskId, taskId))
  }

  // 以当前 owner 身份合并记录残留，避免 stale worker 覆盖新 owner 的恢复数据。
  private async recordResidueForOwner(
    lease: BackgroundTaskExecutionLease,
    residue: BackgroundTaskObject,
  ) {
    this.assertLeaseNotLost(lease)
    const row = await this.readTask(lease.taskId)
    this.assertRowStillOwned(row, lease)
    const mergedResidue = {
      ...this.asObject(row.residue),
      ...residue,
    }
    const now = new Date()
    const [updated] = await this.db
      .update(this.backgroundTask)
      .set({
        claimExpiresAt: this.buildClaimDeadline(now),
        residue: mergedResidue,
        updatedAt: now,
      })
      .where(this.buildOwnerRunningWhere(lease))
      .returning()
    this.assertOwnerWriteMatched(updated, lease)
  }

  // 获取任务当前状态。
  async getTaskStatus(taskId: string) {
    return (await this.readTask(taskId)).status as BackgroundTaskStatusEnum
  }

  // 判断任务是否已请求取消。
  async isTaskCancelRequested(taskId: string) {
    const row = await this.readTask(taskId)
    return row.cancelRequestedAt !== null
  }

  // 启动 claim heartbeat，长时间无业务写入时也能持续续租。
  private startClaimHeartbeat(lease: BackgroundTaskExecutionLease) {
    const timer = setInterval(() => {
      void this.renewClaimForOwner(lease).catch((error) => {
        if (error instanceof BackgroundTaskClaimLostError) {
          clearInterval(timer)
          return
        }
        this.logger.error({
          message: 'background_task_claim_heartbeat_failed',
          taskId: lease.taskId,
          error: this.toErrorObject(error),
        })
      })
    }, BACKGROUND_TASK_CLAIM_RENEW_INTERVAL_SECONDS * 1000)

    return () => clearInterval(timer)
  }

  // 以当前 owner 身份续租 claim；0 行更新代表旧 worker 已失去所有权。
  private async renewClaimForOwner(lease: BackgroundTaskExecutionLease) {
    this.assertLeaseNotLost(lease)
    const now = new Date()
    const [row] = await this.db
      .update(this.backgroundTask)
      .set({
        claimExpiresAt: this.buildClaimDeadline(now),
        updatedAt: now,
      })
      .where(this.buildOwnerRunningWhere(lease))
      .returning()
    this.assertOwnerWriteMatched(row, lease)
  }

  // 校验当前 worker 仍拥有任务 claim。
  private async assertStillOwnedForOwner(lease: BackgroundTaskExecutionLease) {
    this.assertLeaseNotLost(lease)
    const row = await this.readTask(lease.taskId)
    this.assertRowStillOwned(row, lease)
  }

  // 在同一次读取中同时确认 owner 与取消状态，避免 stale owner 被误判为取消。
  private async isCancelRequestedForOwner(lease: BackgroundTaskExecutionLease) {
    this.assertLeaseNotLost(lease)
    const row = await this.readTask(lease.taskId)
    this.assertRowStillOwned(row, lease)
    return row.cancelRequestedAt !== null
  }

  // 已知 claim 丢失时直接抛出，防止 stale owner 进入取消或回滚分支。
  private assertLeaseNotLost(lease: BackgroundTaskExecutionLease) {
    if (lease.claimLost) {
      throw new BackgroundTaskClaimLostError()
    }
  }

  // 校验读到的任务行仍属于当前 owner 且处于运行中。
  private assertRowStillOwned(
    row: BackgroundTaskSelect,
    lease: BackgroundTaskExecutionLease,
  ) {
    if (!this.isRowOwnedAndRunning(row, lease.ownerWorkerId)) {
      lease.claimLost = true
      throw new BackgroundTaskClaimLostError()
    }
  }

  // 校验 owner-aware 写入命中了当前 worker 持有的任务行。
  private assertOwnerWriteMatched(
    row: BackgroundTaskSelect | undefined,
    lease: BackgroundTaskExecutionLease,
  ) {
    if (!row) {
      lease.claimLost = true
      throw new BackgroundTaskClaimLostError()
    }
  }

  // 构造当前 owner 在运行态下才允许写入的 where 条件。
  private buildOwnerRunningWhere(lease: BackgroundTaskExecutionLease) {
    return and(
      eq(this.backgroundTask.taskId, lease.taskId),
      eq(this.backgroundTask.claimedBy, lease.ownerWorkerId),
      inArray(
        this.backgroundTask.status,
        BACKGROUND_TASK_EXECUTING_SERIAL_STATUSES,
      ),
    )
  }

  // 判断任务行是否仍由指定 worker 持有且处于可执行状态。
  private isRowOwnedAndRunning(
    row: BackgroundTaskSelect,
    ownerWorkerId: string,
  ) {
    return (
      row.claimedBy === ownerWorkerId &&
      (row.status === BackgroundTaskStatusEnum.PROCESSING ||
        row.status === BackgroundTaskStatusEnum.FINALIZING)
    )
  }

  // 终态写入 0 行时，优先区分 claim 丢失，再保留原有状态冲突语义。
  private async throwClaimLostOrStateConflict(
    taskId: string,
    ownerWorkerId: string,
    message: string,
  ): Promise<never> {
    const latest = await this.readTask(taskId)
    if (!this.isRowOwnedAndRunning(latest, ownerWorkerId)) {
      throw new BackgroundTaskClaimLostError()
    }
    throw new BusinessException(BusinessErrorCode.STATE_CONFLICT, message)
  }

  // 读取后台任务行。
  private async readTask(taskId: string) {
    const [row] = await this.db
      .select()
      .from(this.backgroundTask)
      .where(eq(this.backgroundTask.taskId, taskId))
      .limit(1)

    if (!row) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '后台任务不存在',
      )
    }
    return row
  }

  // 读取任务创建时持久化的冲突键快照。
  private async readConflictKeys(taskId: string) {
    const rows = await this.db
      .select({ conflictKey: this.backgroundTaskConflictKey.conflictKey })
      .from(this.backgroundTaskConflictKey)
      .where(eq(this.backgroundTaskConflictKey.taskId, taskId))
      .orderBy(
        asc(this.backgroundTaskConflictKey.createdAt),
        asc(this.backgroundTaskConflictKey.id),
      )

    return rows.map((row) => row.conflictKey)
  }

  // 释放任务持有的活动冲突键；dedupe/serial 由任务状态 partial index 自动释放。
  private async releaseConflictKeys(taskId: string, db: Db, now: Date) {
    await db
      .update(this.backgroundTaskConflictKey)
      .set({
        releasedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(this.backgroundTaskConflictKey.taskId, taskId),
          isNull(this.backgroundTaskConflictKey.releasedAt),
        ),
      )
  }

  // 重试时重新激活同一任务的冲突键快照。
  private async reactivateConflictKeys(taskId: string, db: Db, now: Date) {
    await db
      .update(this.backgroundTaskConflictKey)
      .set({
        releasedAt: null,
        updatedAt: now,
      })
      .where(eq(this.backgroundTaskConflictKey.taskId, taskId))
  }

  // 任务进入最终写入阶段。
  private async markTaskFinalizing(taskId: string, ownerWorkerId: string) {
    const now = new Date()
    const deadline = this.buildClaimDeadline(now)
    const [row] = await this.db
      .update(this.backgroundTask)
      .set({
        status: BackgroundTaskStatusEnum.FINALIZING,
        finalizingAt: now,
        claimExpiresAt: deadline,
        updatedAt: now,
      })
      .where(
        and(
          eq(this.backgroundTask.taskId, taskId),
          eq(this.backgroundTask.status, BackgroundTaskStatusEnum.PROCESSING),
          eq(this.backgroundTask.claimedBy, ownerWorkerId),
        ),
      )
      .returning()
    if (!row) {
      await this.throwClaimLostOrStateConflict(
        taskId,
        ownerWorkerId,
        '后台任务无法进入最终写入阶段',
      )
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '后台任务无法进入最终写入阶段',
      )
    }
  }

  // 标记任务成功，只有该状态允许业务副作用保留。
  private async markTaskSucceeded(
    taskId: string,
    ownerWorkerId: string,
    result: BackgroundTaskObject,
  ) {
    const now = new Date()
    const row = await this.runInDbTransaction(async (tx) => {
      const [succeeded] = await tx
        .update(this.backgroundTask)
        .set({
          status: BackgroundTaskStatusEnum.SUCCESS,
          result,
          error: null,
          rollbackError: null,
          claimedBy: null,
          claimExpiresAt: null,
          finishedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(this.backgroundTask.taskId, taskId),
            eq(this.backgroundTask.status, BackgroundTaskStatusEnum.FINALIZING),
            eq(this.backgroundTask.claimedBy, ownerWorkerId),
            isNull(this.backgroundTask.cancelRequestedAt),
          ),
        )
        .returning()

      if (succeeded) {
        await this.releaseConflictKeys(succeeded.taskId, tx, now)
      }

      return succeeded
    })

    if (!row) {
      const latest = await this.readTask(taskId)
      if (!this.isRowOwnedAndRunning(latest, ownerWorkerId)) {
        throw new BackgroundTaskClaimLostError()
      }
      if (latest.cancelRequestedAt) {
        throw new BackgroundTaskCancellationError()
      }
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '后台任务成功状态写入冲突',
      )
    }
  }

  // 回滚未成功任务，并根据回滚结果进入清洁失败、清洁取消或回滚失败。
  private async rollbackUnsuccessfulTask(
    row: BackgroundTaskSelect,
    handler: BackgroundTaskHandler,
    context: BackgroundTaskExecutionContext,
    error: unknown,
  ) {
    if (error instanceof BackgroundTaskClaimLostError) {
      return
    }

    let shouldCancel: boolean
    try {
      shouldCancel =
        error instanceof BackgroundTaskCancellationError ||
        (await context.isCancelRequested())
    } catch (cancelCheckError) {
      if (cancelCheckError instanceof BackgroundTaskClaimLostError) {
        return
      }
      throw cancelCheckError
    }

    const errorObject = this.toErrorObject(error)
    try {
      await handler.rollback(context, error)
      await this.markTaskUnsuccessful(
        row.taskId,
        row.claimedBy ?? '',
        error,
        shouldCancel,
        errorObject,
      )
    } catch (rollbackError) {
      if (rollbackError instanceof BackgroundTaskClaimLostError) {
        return
      }
      const rollbackErrorObject = this.toErrorObject(rollbackError)
      await this.markTaskRollbackFailed(
        row.taskId,
        row.claimedBy ?? '',
        error,
        rollbackError,
        errorObject,
        rollbackErrorObject,
      )
      this.logger.error({
        message: 'background_task_rollback_failed',
        taskId: row.taskId,
        taskType: row.taskType,
        error: errorObject,
        rollbackError: rollbackErrorObject,
      })
      return
    }

    if (!shouldCancel) {
      this.logger.error({
        message: 'background_task_failed',
        taskId: row.taskId,
        taskType: row.taskType,
        status: BackgroundTaskStatusEnum.FAILED,
        error: errorObject,
      })
    }
  }

  // 标记任务已清洁失败或已清洁取消。
  private async markTaskUnsuccessful(
    taskId: string,
    ownerWorkerId: string,
    error: unknown,
    cancelled: boolean,
    errorObject = this.toErrorObject(error),
  ) {
    const now = new Date()
    await this.runInDbTransaction(async (tx) => {
      const [updated] = await tx
        .update(this.backgroundTask)
        .set({
          status: cancelled
            ? BackgroundTaskStatusEnum.CANCELLED
            : BackgroundTaskStatusEnum.FAILED,
          error: errorObject,
          rollbackError: null,
          claimedBy: null,
          claimExpiresAt: null,
          finishedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(this.backgroundTask.taskId, taskId),
            eq(this.backgroundTask.claimedBy, ownerWorkerId),
            inArray(
              this.backgroundTask.status,
              BACKGROUND_TASK_EXECUTING_SERIAL_STATUSES,
            ),
          ),
        )
        .returning()

      if (!updated) {
        throw new BackgroundTaskClaimLostError()
      }

      await this.releaseConflictKeys(updated.taskId, tx, now)
    })
  }

  // 标记回滚失败，避免把残留任务报告成 clean failure/cancel。
  private async markTaskRollbackFailed(
    taskId: string,
    ownerWorkerId: string,
    error: unknown,
    rollbackError: unknown,
    errorObject = this.toErrorObject(error),
    rollbackErrorObject = this.toErrorObject(rollbackError),
  ) {
    const now = new Date()
    const [updated] = await this.db
      .update(this.backgroundTask)
      .set({
        status: BackgroundTaskStatusEnum.ROLLBACK_FAILED,
        error: errorObject,
        rollbackError: rollbackErrorObject,
        claimedBy: null,
        claimExpiresAt: null,
        finishedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(this.backgroundTask.taskId, taskId),
          eq(this.backgroundTask.claimedBy, ownerWorkerId),
          inArray(
            this.backgroundTask.status,
            BACKGROUND_TASK_EXECUTING_SERIAL_STATUSES,
          ),
        ),
      )
      .returning()
    if (!updated) {
      throw new BackgroundTaskClaimLostError()
    }
  }

  // 构建处理器执行上下文。
  private buildExecutionContext(
    row: BackgroundTaskSelect,
    lease: BackgroundTaskExecutionLease,
  ): BackgroundTaskExecutionContext {
    return {
      taskId: row.taskId,
      taskType: row.taskType,
      payload: this.asObject(row.payload),
      getStatus: async () => this.getTaskStatus(row.taskId),
      isCancelRequested: async () => this.isCancelRequestedForOwner(lease),
      assertNotCancelled: async () => {
        if (await this.isCancelRequestedForOwner(lease)) {
          throw new BackgroundTaskCancellationError()
        }
      },
      assertStillOwned: async () => this.assertStillOwnedForOwner(lease),
      updateProgress: async (progress) =>
        this.updateProgressForOwner(lease, progress),
      createProgressReporter: (options) =>
        this.createProgressReporterForOwner(lease, options),
      recordResidue: async (residue) =>
        this.recordResidueForOwner(lease, residue as BackgroundTaskObject),
      getResidue: async () =>
        this.asObject((await this.readTask(row.taskId)).residue),
    }
  }

  // 创建 owner-aware 进度 reporter，确保每次 advance 都校验 claim。
  private createProgressReporterForOwner(
    lease: BackgroundTaskExecutionLease,
    options: BackgroundTaskProgressReporterOptions,
  ): BackgroundTaskProgressReporter {
    return this.createProgressReporter(options, (progress) =>
      this.updateProgressForOwner(lease, progress),
    )
  }

  // 创建按区间映射的进度 reporter，统一处理 clamp 和单调递增。
  private createProgressReporter(
    options: BackgroundTaskProgressReporterOptions,
    updateProgress: (progress: BackgroundTaskProgress) => Promise<void>,
  ): BackgroundTaskProgressReporter {
    const total = this.normalizeProgressTotal(options.total)
    const startPercent = this.normalizeProgressPercent(
      options.startPercent ?? 0,
    )
    const endPercent = Math.max(
      startPercent,
      this.normalizeProgressPercent(options.endPercent ?? 100),
    )
    let current = 0
    let lastPercent = startPercent

    return {
      advance: async (input = {}) => {
        const nextCurrent =
          input.current === undefined
            ? current + this.normalizeProgressAmount(input.amount ?? 1)
            : input.current
        current = Math.max(
          current,
          this.normalizeProgressCurrent(nextCurrent, total),
        )
        const percent = this.resolveReporterPercent(
          startPercent,
          endPercent,
          current,
          total,
          lastPercent,
        )
        lastPercent = percent
        const progress = this.compactProgress({
          percent,
          message: input.message ?? options.message,
          stage: options.stage,
          unit: options.unit,
          current,
          total,
          detail: input.detail ?? options.detail,
        })
        await updateProgress(progress)
        return progress
      },
    }
  }

  // 将 reporter 总量收敛为非负整数，避免 NaN/Infinity 进入 progress。
  private normalizeProgressTotal(total: number) {
    return Number.isFinite(total) && total > 0 ? Math.floor(total) : 0
  }

  // 将单次推进量收敛为非负整数。
  private normalizeProgressAmount(amount: number) {
    return Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 0
  }

  // 将 current 限制在 0-total 区间。
  private normalizeProgressCurrent(current: number, total: number) {
    if (!Number.isFinite(current) || current <= 0) {
      return 0
    }
    const normalized = Math.floor(current)
    return total > 0 ? Math.min(normalized, total) : normalized
  }

  // 将 percent 限制在 0-100 区间。
  private normalizeProgressPercent(percent: number) {
    if (!Number.isFinite(percent)) {
      return 0
    }
    return Math.min(100, Math.max(0, Math.floor(percent)))
  }

  // 根据 current/total 映射 reporter 区间，并保证同一 reporter 内不倒退。
  private resolveReporterPercent(
    startPercent: number,
    endPercent: number,
    current: number,
    total: number,
    lastPercent: number,
  ) {
    if (total <= 0) {
      return Math.max(lastPercent, startPercent)
    }
    const mapped =
      current >= total
        ? endPercent
        : Math.floor(
            startPercent + ((endPercent - startPercent) * current) / total,
          )
    return Math.max(lastPercent, this.normalizeProgressPercent(mapped))
  }

  // 删除进度快照中的 undefined 和空 detail，保持覆盖写入时结构清晰。
  private compactProgress(progress: BackgroundTaskProgress) {
    const compacted: BackgroundTaskProgress = {}
    for (const [key, value] of Object.entries(progress)) {
      if (value === undefined) {
        continue
      }
      if (
        key === 'detail' &&
        this.isPlainObject(value) &&
        Object.keys(value).length === 0
      ) {
        continue
      }
      compacted[key] = value
    }
    return compacted
  }

  // 构建 claim 过期时间。
  private buildClaimDeadline(now = new Date()) {
    const deadline = new Date(now)
    deadline.setSeconds(
      deadline.getSeconds() + BACKGROUND_TASK_CLAIM_TIMEOUT_SECONDS,
    )
    return deadline
  }

  // 仅运行中状态需要续租 claim。
  private shouldExtendClaim(status: number) {
    return (
      status === BackgroundTaskStatusEnum.PROCESSING ||
      status === BackgroundTaskStatusEnum.FINALIZING
    )
  }

  // 解析后台任务列表创建时间筛选，兼容 admin DatePicker 的日期时间格式。
  private parseCreatedAtFilter(
    value: null | string | undefined,
    bound: 'end' | 'start',
  ) {
    const trimmedValue = value?.trim()
    if (!trimmedValue) {
      return undefined
    }

    for (const { dateOnly, format, pattern } of [
      {
        format: 'YYYY-MM-DD HH:mm:ss',
        pattern: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
      },
      {
        format: 'YYYY-MM-DDTHH:mm:ss',
        pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,
      },
      {
        dateOnly: true,
        format: 'YYYY-MM-DD',
        pattern: /^\d{4}-\d{2}-\d{2}$/,
      },
    ]) {
      if (!pattern.test(trimmedValue)) {
        continue
      }
      const parsedValue = dayjs.tz(trimmedValue, format, getAppTimeZone())
      if (
        parsedValue.isValid() &&
        parsedValue.format(format) === trimmedValue
      ) {
        return dateOnly && bound === 'end'
          ? parsedValue.endOf('day').toDate()
          : parsedValue.toDate()
      }
    }

    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/.test(
        trimmedValue,
      )
    ) {
      return undefined
    }

    const parsedIsoValue = dayjs(trimmedValue)
    return parsedIsoValue.isValid() ? parsedIsoValue.toDate() : undefined
  }

  // 转换数据库行为接口 DTO。
  private toTaskDto(row: BackgroundTaskSelect) {
    return {
      id: Number(row.id),
      taskId: row.taskId,
      taskType: row.taskType,
      dedupeKey: row.dedupeKey,
      serialKey: row.serialKey,
      operatorType: row.operatorType,
      operatorUserId: row.operatorUserId,
      status: this.normalizeStatus(row.status),
      payload: this.asObject(row.payload),
      progress: this.asObject(row.progress),
      result: this.asNullableObject(row.result),
      error: this.asNullableObject(row.error),
      residue: this.asNullableObject(row.residue),
      rollbackError: this.asNullableObject(row.rollbackError),
      retryCount: row.retryCount,
      maxRetries: row.maxRetries,
      cancelRequestedAt: row.cancelRequestedAt,
      claimedBy: row.claimedBy,
      claimExpiresAt: row.claimExpiresAt,
      startedAt: row.startedAt,
      finalizingAt: row.finalizingAt,
      finishedAt: row.finishedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  // 转换数据库行为轻量通知轮询 DTO。
  private toTaskNotificationDto(row: BackgroundTaskNotificationSelect) {
    return {
      taskId: row.taskId,
      taskType: row.taskType,
      status: this.normalizeStatus(row.status),
      progress: this.compactNotificationProgress(row.progress),
      updatedAt: row.updatedAt,
    }
  }

  // 通知轮询只保留 header 展示需要的进度字段，避免 detail 大对象进入高频响应。
  private compactNotificationProgress(value: unknown) {
    const progress = this.asObject(value)
    const notificationProgress: BackgroundTaskObject = {}
    if (typeof progress.percent === 'number') {
      notificationProgress.percent = progress.percent
    }
    if (typeof progress.message === 'string') {
      notificationProgress.message = progress.message
    }
    return notificationProgress
  }

  // 归一化状态值。
  private normalizeStatus(status: number) {
    if (
      Object.values(BackgroundTaskStatusEnum).includes(
        status as BackgroundTaskStatusEnum,
      )
    ) {
      return status as BackgroundTaskStatusEnum
    }
    throw new BusinessException(
      BusinessErrorCode.STATE_CONFLICT,
      '后台任务状态非法',
    )
  }

  // 转换未知值为对象。
  private asObject(value: unknown): BackgroundTaskObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as BackgroundTaskObject)
      : {}
  }

  // 转换未知值为可空对象。
  private asNullableObject(value: unknown) {
    return value === null ? null : this.asObject(value)
  }

  // 转换错误为结构化对象。
  private toErrorObject(error: unknown) {
    if (error instanceof Error) {
      return this.compactErrorObject({
        name: error.name,
        message: this.toSafeErrorString(error.message),
        cause: this.toSafeCause(error.cause),
      })
    }

    if (typeof error === 'string') {
      return {
        message: this.toSafeErrorString(error),
      }
    }

    return {
      message: this.toSafeErrorString(this.stringifyError(error)),
    }
  }

  // 转换 Error.cause 为可落库和可打日志的安全 JSON 摘要。
  private toSafeCause(value: unknown, depth = 0): unknown {
    if (value === undefined) {
      return undefined
    }
    if (value === null) {
      return null
    }
    if (typeof value === 'string') {
      return this.toSafeErrorString(value)
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value
    }
    if (typeof value === 'bigint') {
      return value.toString()
    }
    if (Array.isArray(value)) {
      if (depth >= this.maxErrorCauseDepth) {
        return '[Array]'
      }
      return value
        .slice(0, this.maxErrorCauseArrayLength)
        .map((item) => this.toSafeCause(item, depth + 1))
    }
    if (value instanceof Date) {
      return value.toISOString()
    }
    if (value instanceof Error) {
      const nestedCause =
        depth >= this.maxErrorCauseDepth
          ? undefined
          : this.toSafeCause(value.cause, depth + 1)
      return this.compactErrorObject({
        name: value.name,
        message: this.toSafeErrorString(value.message),
        cause: nestedCause,
      })
    }
    if (this.isPlainObject(value)) {
      if (depth >= this.maxErrorCauseDepth) {
        return '[Object]'
      }

      const safeObject: Record<string, unknown> = {}
      for (const [key, nestedValue] of Object.entries(value).slice(
        0,
        this.maxErrorCauseObjectKeys,
      )) {
        if (this.isSensitiveErrorCauseKey(key)) {
          continue
        }
        const safeValue = this.toSafeCause(nestedValue, depth + 1)
        if (safeValue !== undefined) {
          safeObject[key] = safeValue
        }
      }
      return safeObject
    }

    return this.toSafeErrorString(String(value))
  }

  // 删除错误对象中的空 cause，保持旧错误结构尽量稳定。
  private compactErrorObject(value: Record<string, unknown>) {
    const compacted: Record<string, unknown> = {}
    for (const [key, nestedValue] of Object.entries(value)) {
      if (nestedValue === undefined) {
        continue
      }
      if (
        this.isPlainObject(nestedValue) &&
        Object.keys(nestedValue).length === 0
      ) {
        continue
      }
      compacted[key] = nestedValue
    }
    return compacted
  }

  // 判断是否是普通对象，避免把请求实例、流或 ORM 对象完整写入错误 JSON。
  private isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false
    }
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  }

  // 删除会携带凭据、请求体或底层请求配置的错误 cause 字段。
  private isSensitiveErrorCauseKey(key: string) {
    return /authorization|cookie|headers|body|form|config|request|password|secret|token/i.test(
      key,
    )
  }

  // 遮蔽错误文本中的常见凭据片段，避免 key 脱敏后仍通过 value 泄露。
  private toSafeErrorString(value: string) {
    return this.truncateErrorCauseString(
      value
        .replace(
          /"(?:token|authorization|cookie|password|secret)"[ \t]{0,20}:[ \t]{0,20}"[^"]*"/gi,
          '"[REDACTED]"',
        )
        .replace(
          /(?:token|authorization|cookie|password|secret)[ \t]{0,20}=[ \t]{0,20}[^"',\s;}]+/gi,
          '[REDACTED]',
        )
        .replace(
          /(?:token|authorization|cookie|password|secret)[ \t]{0,20}:[ \t]{0,20}[^"',\s;}]+/gi,
          '[REDACTED]',
        )
        .replace(/\bBearer\s+[^,\s;}]+/gi, 'Bearer [REDACTED]'),
    )
  }

  // 限制 cause 字符串长度，避免第三方错误响应过大。
  private truncateErrorCauseString(value: string) {
    return value.length > this.maxErrorCauseStringLength
      ? `${value.slice(0, this.maxErrorCauseStringLength)}...`
      : value
  }

  // 转换错误文本。
  private stringifyError(error: unknown) {
    if (error instanceof Error) {
      return error.message
    }
    if (typeof error === 'string') {
      return error
    }
    try {
      return JSON.stringify(error)
    } catch {
      return 'unknown error'
    }
  }
}
