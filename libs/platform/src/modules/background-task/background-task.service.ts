import type { BackgroundTaskSelect } from '@db/schema'
import type { SQL } from 'drizzle-orm'
import type {
  BackgroundTaskExecutionContext,
  BackgroundTaskHandler,
  BackgroundTaskObject,
  BackgroundTaskProgress,
  BackgroundTaskProgressReporter,
  BackgroundTaskProgressReporterOptions,
  CreateBackgroundTaskInput,
} from './types'
import { randomUUID } from 'node:crypto'
import { DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { getAppTimeZone } from '@libs/platform/utils'
import { Injectable, Logger } from '@nestjs/common'
import dayjs from 'dayjs'
import { and, asc, eq, gte, isNull, lte, or } from 'drizzle-orm'
import {
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

  // 创建待处理后台任务，只入队不执行任何业务处理器。
  async createTask(input: CreateBackgroundTaskInput) {
    const operator = this.normalizeTaskOperator(input.operator)
    if (!this.registry.has(input.taskType)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `后台任务处理器不存在: ${input.taskType}`,
      )
    }

    const now = new Date()
    const [row] = await this.drizzle.withErrorHandling(
      () =>
        this.db
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
          .returning(),
      { duplicate: '后台任务ID已存在' },
    )

    return this.toTaskDto(row)
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

  // 分页查询当前后台管理员创建的后台任务。
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
    })

    return {
      ...page,
      list: page.list.map((row) => this.toTaskDto(row)),
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
      const [cancelled] = await this.db
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

    const now = new Date()
    const [retried] = await this.db
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
            eq(this.backgroundTask.status, BackgroundTaskStatusEnum.CANCELLED),
          ),
          isNull(this.backgroundTask.rollbackError),
        ),
      )
      .returning()

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
    const [candidate] = await this.db
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
      .limit(1)

    if (!candidate) {
      return null
    }

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

  // 执行已 claim 任务，失败或取消都必须进入补偿清理。
  async executeClaimedTask(row: BackgroundTaskSelect) {
    const handler = this.registry.resolve(row.taskType)
    const context = this.buildExecutionContext(row)
    let prepared: unknown

    try {
      if (row.status === BackgroundTaskStatusEnum.FINALIZING) {
        throw new BackgroundTaskFinalizingExpiredError()
      }
      prepared = await handler.prepare?.(context)
      await context.assertNotCancelled()
      await this.markTaskFinalizing(row.taskId)
      await context.assertNotCancelled()
      const result = await handler.finalize(context, prepared)
      await this.markTaskSucceeded(row.taskId, result)
    } catch (error) {
      await this.rollbackUnsuccessfulTask(row, handler, context, error)
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

  // 获取任务当前状态。
  async getTaskStatus(taskId: string) {
    return (await this.readTask(taskId)).status as BackgroundTaskStatusEnum
  }

  // 判断任务是否已请求取消。
  async isTaskCancelRequested(taskId: string) {
    const row = await this.readTask(taskId)
    return row.cancelRequestedAt !== null
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

  // 任务进入最终写入阶段。
  private async markTaskFinalizing(taskId: string) {
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
        ),
      )
      .returning()
    if (!row) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '后台任务无法进入最终写入阶段',
      )
    }
  }

  // 标记任务成功，只有该状态允许业务副作用保留。
  private async markTaskSucceeded(
    taskId: string,
    result: BackgroundTaskObject,
  ) {
    const now = new Date()
    const [row] = await this.db
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
          isNull(this.backgroundTask.cancelRequestedAt),
        ),
      )
      .returning()

    if (!row) {
      const latest = await this.readTask(taskId)
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
    const shouldCancel =
      error instanceof BackgroundTaskCancellationError ||
      (await this.isTaskCancelRequested(row.taskId))

    const errorObject = this.toErrorObject(error)
    try {
      await handler.rollback(context, error)
      await this.markTaskUnsuccessful(
        row.taskId,
        error,
        shouldCancel,
        errorObject,
      )
    } catch (rollbackError) {
      const rollbackErrorObject = this.toErrorObject(rollbackError)
      await this.markTaskRollbackFailed(
        row.taskId,
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
    error: unknown,
    cancelled: boolean,
    errorObject = this.toErrorObject(error),
  ) {
    const now = new Date()
    await this.db
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
      .where(eq(this.backgroundTask.taskId, taskId))
  }

  // 标记回滚失败，避免把残留任务报告成 clean failure/cancel。
  private async markTaskRollbackFailed(
    taskId: string,
    error: unknown,
    rollbackError: unknown,
    errorObject = this.toErrorObject(error),
    rollbackErrorObject = this.toErrorObject(rollbackError),
  ) {
    const now = new Date()
    await this.db
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
      .where(eq(this.backgroundTask.taskId, taskId))
  }

  // 构建处理器执行上下文。
  private buildExecutionContext(
    row: BackgroundTaskSelect,
  ): BackgroundTaskExecutionContext {
    return {
      taskId: row.taskId,
      taskType: row.taskType,
      payload: this.asObject(row.payload),
      getStatus: async () => this.getTaskStatus(row.taskId),
      isCancelRequested: async () => this.isTaskCancelRequested(row.taskId),
      assertNotCancelled: async () => {
        if (await this.isTaskCancelRequested(row.taskId)) {
          throw new BackgroundTaskCancellationError()
        }
      },
      updateProgress: async (progress) =>
        this.updateProgress(row.taskId, progress),
      createProgressReporter: (options) =>
        this.createProgressReporter(row.taskId, options),
      recordResidue: async (residue) =>
        this.recordResidue(row.taskId, residue as BackgroundTaskObject),
      getResidue: async () =>
        this.asObject((await this.readTask(row.taskId)).residue),
    }
  }

  // 创建按区间映射的进度 reporter，统一处理 clamp 和单调递增。
  private createProgressReporter(
    taskId: string,
    options: BackgroundTaskProgressReporterOptions,
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
        await this.updateProgress(taskId, progress)
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
