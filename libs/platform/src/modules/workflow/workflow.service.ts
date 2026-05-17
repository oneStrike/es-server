import type { Db, PostgresErrorSource } from '@db/core'
import type {
  WorkflowAttemptSelect,
  WorkflowEventSelect,
  WorkflowJobSelect,
} from '@db/schema'
import type { SQL } from 'drizzle-orm'
import type {
  AppendWorkflowEventInput,
  CompleteWorkflowAttemptByAttemptIdInput,
  CompleteWorkflowAttemptInput,
  CreateWorkflowJobInput,
  WorkflowDatabaseErrorMessages,
  WorkflowExpiredAttemptRecoveryResult,
  WorkflowObject,
  WorkflowProgress,
  WorkflowStatusCounters,
} from './workflow.type'
import { randomUUID } from 'node:crypto'
import process from 'node:process'
import { DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, Logger } from '@nestjs/common'
import { and, asc, desc, eq, gt, isNull, lte } from 'drizzle-orm'
import {
  WorkflowExpireDto,
  WorkflowJobIdDto,
  WorkflowJobPageRequestDto,
  WorkflowRetryItemsDto,
} from './dto'
import {
  WORKFLOW_CLAIM_TIMEOUT_SECONDS,
  WORKFLOW_RETRYABLE_JOB_STATUSES,
  WORKFLOW_TERMINAL_JOB_STATUSES,
  WORKFLOW_WORKER_BATCH_SIZE,
  WorkflowAttemptStatusEnum,
  WorkflowAttemptTriggerTypeEnum,
  WorkflowEventTypeEnum,
  WorkflowJobStatusEnum,
  WorkflowOperatorTypeEnum,
} from './workflow.constant'
import { WorkflowRegistry } from './workflow.registry'

class WorkflowCancellationError extends Error {
  constructor() {
    super('工作流任务已请求取消')
    this.name = 'WorkflowCancellationError'
  }
}

class WorkflowClaimLostError extends Error {
  constructor() {
    super('工作流 attempt claim 已丢失')
    this.name = 'WorkflowClaimLostError'
  }
}

/**
 * 通用工作流服务。
 * 负责工作流任务、attempt、claim、取消、重试和事件，不持有内容导入业务逻辑。
 */
@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name)

  // 初始化工作流服务依赖。
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly registry: WorkflowRegistry,
  ) {}

  // 读取 db。
  private get db() {
    return this.drizzle.db
  }

  // 读取 workflowJob 表。
  private get workflowJob() {
    return this.drizzle.schema.workflowJob
  }

  // 读取 workflowAttempt 表。
  private get workflowAttempt() {
    return this.drizzle.schema.workflowAttempt
  }

  // 读取 workflowEvent 表。
  private get workflowEvent() {
    return this.drizzle.schema.workflowEvent
  }

  // 读取 workflowConflictKey 表。
  private get workflowConflictKey() {
    return this.drizzle.schema.workflowConflictKey
  }

  // 创建草稿工作流任务。
  async createDraft(input: CreateWorkflowJobInput) {
    return this.drizzle.withTransaction(async (tx) => {
      const row = await this.createDraftWithDb(input, tx)
      await this.appendEventWithDb(
        {
          workflowJobId: row.id,
          eventType: WorkflowEventTypeEnum.JOB_CREATED,
          message: '工作流任务已创建',
          detail: { jobId: row.jobId, workflowType: row.workflowType },
        },
        tx,
      )
      return this.toJobDto(row)
    })
  }

  // 在调用方事务内创建工作流草稿。
  async createDraftInTransaction(input: CreateWorkflowJobInput, tx: Db) {
    return this.toJobDto(await this.createDraftWithDb(input, tx))
  }

  // 确认草稿并创建首次 attempt。
  async confirmDraft(input: WorkflowJobIdDto) {
    return this.drizzle.withTransaction(async (tx) => {
      const job = await this.readJobWithDb(input.jobId, tx)
      if (job.status !== WorkflowJobStatusEnum.DRAFT) {
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          '只有草稿工作流任务可以确认',
        )
      }

      const attempt = await this.createAttemptWithDb(
        job,
        WorkflowAttemptTriggerTypeEnum.INITIAL_CONFIRM,
        tx,
      )
      const [updatedJob] = await tx
        .update(this.workflowJob)
        .set({
          status: WorkflowJobStatusEnum.PENDING,
          currentAttemptFk: attempt.id,
          updatedAt: new Date(),
        })
        .where(eq(this.workflowJob.id, job.id))
        .returning()

      await this.appendEventWithDb(
        {
          workflowJobId: job.id,
          workflowAttemptId: attempt.id,
          eventType: WorkflowEventTypeEnum.JOB_CONFIRMED,
          message: '工作流任务已确认',
          detail: { jobId: job.jobId, attemptId: attempt.attemptId },
        },
        tx,
      )

      return this.toJobDto(updatedJob)
    })
  }

  // 分页查询工作流任务。
  async getJobPage(input: WorkflowJobPageRequestDto) {
    const conditions: SQL[] = []
    if (input.jobId) {
      conditions.push(eq(this.workflowJob.jobId, input.jobId))
    }
    if (input.workflowType) {
      conditions.push(eq(this.workflowJob.workflowType, input.workflowType))
    }
    if (input.status !== undefined) {
      conditions.push(eq(this.workflowJob.status, input.status))
    }

    const page = await this.drizzle.ext.findPagination(this.workflowJob, {
      where: conditions.length ? and(...conditions) : undefined,
      pageIndex: input.pageIndex,
      pageSize: input.pageSize,
      orderBy: input.orderBy?.trim()
        ? input.orderBy
        : { updatedAt: 'desc', id: 'desc' },
    })

    return {
      ...page,
      list: page.list.map((row) => this.toJobDto(row)),
    }
  }

  // 查询工作流详情。
  async getJobDetail(input: WorkflowJobIdDto) {
    const job = await this.readJob(input.jobId)
    const attempts = await this.db
      .select()
      .from(this.workflowAttempt)
      .where(eq(this.workflowAttempt.workflowJobId, job.id))
      .orderBy(asc(this.workflowAttempt.attemptNo))
    const events = await this.db
      .select()
      .from(this.workflowEvent)
      .where(eq(this.workflowEvent.workflowJobId, job.id))
      .orderBy(asc(this.workflowEvent.createdAt), asc(this.workflowEvent.id))

    return {
      ...this.toJobDto(job),
      attempts: attempts.map((attempt) => this.toAttemptDto(attempt)),
      events: events.map((event) => this.toEventDto(event)),
    }
  }

  // 请求取消工作流任务。
  async cancelJob(input: WorkflowJobIdDto) {
    return this.drizzle.withTransaction(async (tx) => {
      const job = await this.readJobWithDb(input.jobId, tx)
      if (this.isTerminalJobStatus(job.status)) {
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          '终态工作流任务不能取消',
        )
      }

      const now = new Date()
      const nextStatus =
        job.status === WorkflowJobStatusEnum.RUNNING
          ? WorkflowJobStatusEnum.RUNNING
          : WorkflowJobStatusEnum.CANCELLED
      const [updatedJob] = await tx
        .update(this.workflowJob)
        .set({
          status: nextStatus,
          cancelRequestedAt: now,
          finishedAt:
            nextStatus === WorkflowJobStatusEnum.CANCELLED ? now : job.finishedAt,
          updatedAt: now,
        })
        .where(eq(this.workflowJob.id, job.id))
        .returning()

      if (nextStatus === WorkflowJobStatusEnum.CANCELLED) {
        await this.cancelPendingAttempts(job.id, tx, now)
        await this.releaseConflictKeys(job.id, tx, now)
      }

      await this.appendEventWithDb(
        {
          workflowJobId: job.id,
          workflowAttemptId: job.currentAttemptFk,
          eventType: WorkflowEventTypeEnum.CANCEL_REQUESTED,
          message: '工作流任务已请求取消',
          detail: { jobId: job.jobId },
        },
        tx,
      )
      return this.toJobDto(updatedJob)
    })
  }

  // 人工重试失败条目。
  async retryItems(input: WorkflowRetryItemsDto) {
    return this.drizzle.withTransaction(async (tx) => {
      const job = await this.readJobWithDb(input.jobId, tx)
      if (!WORKFLOW_RETRYABLE_JOB_STATUSES.includes(job.status)) {
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          '只有失败或部分失败的工作流任务可以重试',
        )
      }

      const conflictKeys = await this.readJobConflictKeys(job.id, tx)
      const handler = this.registry.resolve(job.workflowType)
      const nextAttemptNo = await this.resolveNextAttemptNo(job.id, tx)
      await handler.validateRetry?.({
        jobId: job.jobId,
        workflowType: job.workflowType,
        selectedItemIds: input.itemIds,
        conflictKeys,
      })
      await this.reserveConflictKeys(job, conflictKeys, tx)
      await handler.prepareRetry?.(
        {
          jobId: job.jobId,
          workflowType: job.workflowType,
          selectedItemIds: input.itemIds,
          conflictKeys,
        },
        nextAttemptNo,
        tx,
      )

      const attempt = await this.createAttemptWithDb(
        job,
        WorkflowAttemptTriggerTypeEnum.MANUAL_RETRY,
        tx,
        nextAttemptNo,
        input.itemIds.length,
      )
      const [updatedJob] = await tx
        .update(this.workflowJob)
        .set({
          status: WorkflowJobStatusEnum.PENDING,
          currentAttemptFk: attempt.id,
          cancelRequestedAt: null,
          finishedAt: null,
          failedItemCount: Math.max(0, job.failedItemCount),
          updatedAt: new Date(),
        })
        .where(eq(this.workflowJob.id, job.id))
        .returning()

      await this.appendEventWithDb(
        {
          workflowJobId: job.id,
          workflowAttemptId: attempt.id,
          eventType: WorkflowEventTypeEnum.RETRY_REQUESTED,
          message: '工作流任务已创建人工重试 attempt',
          detail: {
            jobId: job.jobId,
            attemptId: attempt.attemptId,
            itemIds: input.itemIds,
          },
        },
        tx,
      )
      return this.toJobDto(updatedJob)
    })
  }

  // 过期清理失败或部分失败工作流保留的 retained resource。
  async expireJob(input: WorkflowExpireDto) {
    return this.drizzle.withTransaction(async (tx) => {
      const job = await this.readJobWithDb(input.jobId, tx)
      if (!WORKFLOW_RETRYABLE_JOB_STATUSES.includes(job.status)) {
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          '只有失败或部分失败的工作流任务可以过期清理',
        )
      }
      const handler = this.registry.resolve(job.workflowType)
      await handler.cleanupRetainedResources?.(job.jobId)
      const now = new Date()
      const [updatedJob] = await tx
        .update(this.workflowJob)
        .set({
          status: WorkflowJobStatusEnum.EXPIRED,
          finishedAt: now,
          updatedAt: now,
        })
        .where(eq(this.workflowJob.id, job.id))
        .returning()
      await this.releaseConflictKeys(job.id, tx, now)
      await this.appendEventWithDb(
        {
          workflowJobId: job.id,
          workflowAttemptId: job.currentAttemptFk,
          eventType: WorkflowEventTypeEnum.CLEANUP_RECORDED,
          message: '工作流任务 retained resource 已过期清理',
          detail: { jobId: job.jobId },
        },
        tx,
      )
      return this.toJobDto(updatedJob)
    })
  }

  // 追加工作流事件。
  async appendEvent(input: AppendWorkflowEventInput) {
    const [event] = await this.db
      .insert(this.workflowEvent)
      .values({
        ...input,
        workflowAttemptId: input.workflowAttemptId ?? null,
        detail: input.detail ?? null,
      })
      .returning()
    return event.id
  }

  // 完成 attempt 并聚合 job 状态。
  async completeAttempt(input: CompleteWorkflowAttemptInput) {
    return this.drizzle.withTransaction(async (tx) => {
      const attempt = await this.readAttemptWithDb(input.workflowAttemptId, tx)
      const job = await this.readJobByIdWithDb(attempt.workflowJobId, tx)
      const now = new Date()
      const [updatedAttempt] = await tx
        .update(this.workflowAttempt)
        .set({
          status: input.status,
          successItemCount: input.successItemCount,
          failedItemCount: input.failedItemCount,
          skippedItemCount: input.skippedItemCount,
          errorCode: input.errorCode ?? null,
          errorMessage: input.errorMessage ?? null,
          claimedBy: null,
          claimExpiresAt: null,
          heartbeatAt: now,
          finishedAt: now,
          updatedAt: now,
        })
        .where(eq(this.workflowAttempt.id, attempt.id))
        .returning()

      const jobStatus = this.resolveJobStatusFromAttempt(updatedAttempt)
      const [updatedJob] = await tx
        .update(this.workflowJob)
        .set({
          status: jobStatus,
          progressPercent:
            jobStatus === WorkflowJobStatusEnum.SUCCESS ? 100 : job.progressPercent,
          successItemCount: input.successItemCount,
          failedItemCount: input.failedItemCount,
          skippedItemCount: input.skippedItemCount,
          finishedAt: now,
          updatedAt: now,
        })
        .where(eq(this.workflowJob.id, job.id))
        .returning()
      await this.releaseConflictKeys(job.id, tx, now)
      await this.appendEventWithDb(
        {
          workflowJobId: job.id,
          workflowAttemptId: attempt.id,
          eventType: WorkflowEventTypeEnum.ATTEMPT_COMPLETED,
          message: '工作流 attempt 已完成',
          detail: {
            jobId: job.jobId,
            attemptId: attempt.attemptId,
            status: input.status,
          },
        },
        tx,
      )
      return this.toJobDto(updatedJob)
    })
  }

  // 使用公开 attemptId 完成 attempt 并聚合 job 状态。
  async completeAttemptByAttemptId(input: CompleteWorkflowAttemptByAttemptIdInput) {
    const attempt = await this.readAttemptByAttemptId(input.attemptId)
    return this.completeAttempt({
      workflowAttemptId: attempt.id,
      status: input.status,
      successItemCount: input.successItemCount,
      failedItemCount: input.failedItemCount,
      skippedItemCount: input.skippedItemCount,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
    })
  }

  // 消费待处理工作流 attempt。
  async consumePendingAttempts() {
    await this.expireDraftJobs()
    await this.recoverExpiredRunningAttempts()
    const pendingAttempts = await this.db
      .select()
      .from(this.workflowAttempt)
      .where(eq(this.workflowAttempt.status, WorkflowAttemptStatusEnum.PENDING))
      .orderBy(asc(this.workflowAttempt.createdAt), asc(this.workflowAttempt.id))
      .limit(WORKFLOW_WORKER_BATCH_SIZE)

    for (const attempt of pendingAttempts) {
      await this.consumeAttempt(attempt.id)
    }
  }

  // 回收 claim 已过期的 RUNNING attempt，避免 worker 崩溃后任务永久卡住。
  private async recoverExpiredRunningAttempts() {
    const now = new Date()
    const expiredAttempts = await this.db
      .select()
      .from(this.workflowAttempt)
      .where(
        and(
          eq(this.workflowAttempt.status, WorkflowAttemptStatusEnum.RUNNING),
          lte(this.workflowAttempt.claimExpiresAt, now),
        ),
      )
      .orderBy(asc(this.workflowAttempt.claimExpiresAt), asc(this.workflowAttempt.id))
      .limit(WORKFLOW_WORKER_BATCH_SIZE)

    for (const attempt of expiredAttempts) {
      await this.recoverExpiredRunningAttempt(attempt.id)
    }
  }

  // 恢复单个过期 RUNNING attempt。
  private async recoverExpiredRunningAttempt(attemptId: bigint) {
    await this.drizzle.withTransaction(async (tx) => {
      const now = new Date()
      const attempt = await this.readAttemptWithDb(attemptId, tx)
      if (
        attempt.status !== WorkflowAttemptStatusEnum.RUNNING ||
        !attempt.claimExpiresAt ||
        attempt.claimExpiresAt > now
      ) {
        return
      }

      const job = await this.readJobByIdWithDb(attempt.workflowJobId, tx)
      if (
        job.status !== WorkflowJobStatusEnum.RUNNING ||
        job.currentAttemptFk !== attempt.id
      ) {
        return
      }

      const [expiredAttempt] = await tx
        .update(this.workflowAttempt)
        .set({
          status: WorkflowAttemptStatusEnum.FAILED,
          claimedBy: null,
          claimExpiresAt: null,
          heartbeatAt: now,
          errorCode: 'ATTEMPT_LEASE_EXPIRED',
          errorMessage: 'workflow attempt claim 已过期',
          finishedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(this.workflowAttempt.id, attempt.id),
            eq(this.workflowAttempt.status, WorkflowAttemptStatusEnum.RUNNING),
            lte(this.workflowAttempt.claimExpiresAt, now),
          ),
        )
        .returning()
      if (!expiredAttempt) {
        return
      }

      const handler = this.registry.resolve(job.workflowType)
      const conflictKeys = await this.readJobConflictKeys(job.id, tx)
      const nextAttemptNo = await this.resolveNextAttemptNo(job.id, tx)
      const recovery =
        (await handler.recoverExpiredAttempt?.(
          {
            jobId: job.jobId,
            workflowType: job.workflowType,
            expiredAttemptNo: attempt.attemptNo,
            conflictKeys,
          },
          nextAttemptNo,
          tx,
        )) ??
        this.buildDefaultExpiredAttemptRecovery(job, attempt)

      const expiredStatus =
        recovery.recoverableItemCount > 0
          ? WorkflowAttemptStatusEnum.FAILED
          : this.resolveAttemptStatusFromCounters(recovery)
      await tx
        .update(this.workflowAttempt)
        .set({
          status: expiredStatus,
          successItemCount: recovery.successItemCount,
          failedItemCount: recovery.failedItemCount,
          skippedItemCount: recovery.skippedItemCount,
          errorCode:
            expiredStatus === WorkflowAttemptStatusEnum.SUCCESS
              ? null
              : 'ATTEMPT_LEASE_EXPIRED',
          errorMessage:
            expiredStatus === WorkflowAttemptStatusEnum.SUCCESS
              ? null
              : 'workflow attempt claim 已过期',
          updatedAt: now,
        })
        .where(eq(this.workflowAttempt.id, expiredAttempt.id))

      await this.appendEventWithDb(
        {
          workflowJobId: job.id,
          workflowAttemptId: expiredAttempt.id,
          eventType: WorkflowEventTypeEnum.ATTEMPT_COMPLETED,
          message: '工作流 attempt claim 过期，已完成恢复判定',
          detail: {
            jobId: job.jobId,
            attemptId: expiredAttempt.attemptId,
            recoverableItemCount: recovery.recoverableItemCount,
            status: expiredStatus,
          },
        },
        tx,
      )

      if (recovery.recoverableItemCount > 0) {
        const recoveryAttempt = await this.createAttemptWithDb(
          job,
          WorkflowAttemptTriggerTypeEnum.SYSTEM_RECOVERY,
          tx,
          nextAttemptNo,
          recovery.recoverableItemCount,
        )
        const [updatedJob] = await tx
          .update(this.workflowJob)
          .set({
            status: WorkflowJobStatusEnum.PENDING,
            currentAttemptFk: recoveryAttempt.id,
            successItemCount: recovery.successItemCount,
            failedItemCount: recovery.failedItemCount,
            skippedItemCount: recovery.skippedItemCount,
            cancelRequestedAt: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(this.workflowJob.id, job.id),
              eq(this.workflowJob.status, WorkflowJobStatusEnum.RUNNING),
              eq(this.workflowJob.currentAttemptFk, expiredAttempt.id),
            ),
          )
          .returning()
        if (!updatedJob) {
          return
        }
        await this.appendEventWithDb(
          {
            workflowJobId: job.id,
            workflowAttemptId: recoveryAttempt.id,
            eventType: WorkflowEventTypeEnum.RETRY_REQUESTED,
            message: '工作流已创建系统恢复 attempt',
            detail: {
              jobId: job.jobId,
              attemptId: recoveryAttempt.attemptId,
              expiredAttemptId: expiredAttempt.attemptId,
              recoverableItemCount: recovery.recoverableItemCount,
            },
          },
          tx,
        )
        return
      }

      const terminalStatus = this.resolveJobStatusFromCounters(recovery)
      const [updatedJob] = await tx
        .update(this.workflowJob)
        .set({
          status: terminalStatus,
          progressPercent:
            terminalStatus === WorkflowJobStatusEnum.SUCCESS
              ? 100
              : job.progressPercent,
          successItemCount: recovery.successItemCount,
          failedItemCount: recovery.failedItemCount,
          skippedItemCount: recovery.skippedItemCount,
          finishedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(this.workflowJob.id, job.id),
            eq(this.workflowJob.status, WorkflowJobStatusEnum.RUNNING),
            eq(this.workflowJob.currentAttemptFk, expiredAttempt.id),
          ),
        )
        .returning()
      if (!updatedJob) {
        return
      }
      await this.releaseConflictKeys(job.id, tx, now)
    })
  }

  // 创建工作流草稿行。
  private async createDraftWithDb(input: CreateWorkflowJobInput, tx: Db) {
    const operator = this.normalizeOperator(input.operator)
    const displayName = this.normalizeRequiredText(input.displayName, '展示名称')
    const workflowType = this.normalizeRequiredText(
      input.workflowType,
      '工作流类型',
    )
    if (!this.registry.has(workflowType)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `工作流处理器不存在: ${workflowType}`,
      )
    }

    const now = new Date()
    const [row] = await tx
      .insert(this.workflowJob)
      .values({
        jobId: randomUUID(),
        workflowType,
        displayName,
        operatorType: operator.operatorType,
        operatorUserId: operator.operatorUserId,
        status: input.status ?? WorkflowJobStatusEnum.DRAFT,
        progressPercent: this.normalizeProgressPercent(input.progress?.percent),
        progressMessage: input.progress?.message ?? null,
        currentAttemptFk: null,
        selectedItemCount: input.selectedItemCount ?? 0,
        successItemCount: 0,
        failedItemCount: 0,
        skippedItemCount: 0,
        cancelRequestedAt: null,
        startedAt: null,
        finishedAt: null,
        expiresAt: input.expiresAt ?? null,
        summary: input.summary ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    await this.reserveConflictKeys(row, input.conflictKeys ?? [], tx)
    return row
  }

  // 消费单个 attempt。
  private async consumeAttempt(attemptId: bigint) {
    const claimed = await this.claimAttempt(attemptId)
    if (!claimed) {
      return
    }
    const { attempt, job } = claimed
    const handler = this.registry.resolve(job.workflowType)
    try {
      await handler.execute(this.buildExecutionContext(job, attempt))
      const latestAttempt = await this.readAttempt(attempt.id)
      if (latestAttempt.status === WorkflowAttemptStatusEnum.RUNNING) {
        await this.completeAttempt({
          workflowAttemptId: attempt.id,
          status: WorkflowAttemptStatusEnum.SUCCESS,
          successItemCount: latestAttempt.selectedItemCount,
          failedItemCount: 0,
          skippedItemCount: 0,
        })
      }
    } catch (error) {
      if (error instanceof WorkflowClaimLostError) {
        return
      }
      const errorObject = this.toErrorObject(error)
      await this.completeAttempt({
        workflowAttemptId: attempt.id,
        status:
          error instanceof WorkflowCancellationError
            ? WorkflowAttemptStatusEnum.CANCELLED
            : WorkflowAttemptStatusEnum.FAILED,
        successItemCount: 0,
        failedItemCount: attempt.selectedItemCount,
        skippedItemCount: 0,
        errorCode: errorObject.name,
        errorMessage: errorObject.message,
      })
      this.logger.error({
        message: 'workflow_attempt_failed',
        jobId: job.jobId,
        attemptId: attempt.attemptId,
        workflowType: job.workflowType,
        error: errorObject,
      })
    }
  }

  // claim 一个待处理 attempt。
  private async claimAttempt(attemptId: bigint) {
    return this.drizzle.withTransaction(async (tx) => {
      const attempt = await this.readAttemptWithDb(attemptId, tx)
      if (attempt.status !== WorkflowAttemptStatusEnum.PENDING) {
        return null
      }
      const job = await this.readJobByIdWithDb(attempt.workflowJobId, tx)
      if (job.status !== WorkflowJobStatusEnum.PENDING) {
        return null
      }
      const now = new Date()
      const [claimedAttempt] = await tx
        .update(this.workflowAttempt)
        .set({
          status: WorkflowAttemptStatusEnum.RUNNING,
          claimedBy: this.buildWorkerId(),
          claimExpiresAt: this.buildClaimDeadline(now),
          heartbeatAt: now,
          startedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(this.workflowAttempt.id, attempt.id),
            eq(this.workflowAttempt.status, WorkflowAttemptStatusEnum.PENDING),
          ),
        )
        .returning()
      if (!claimedAttempt) {
        return null
      }

      const [updatedJob] = await tx
        .update(this.workflowJob)
        .set({
          status: WorkflowJobStatusEnum.RUNNING,
          currentAttemptFk: claimedAttempt.id,
          startedAt: job.startedAt ?? now,
          updatedAt: now,
        })
        .where(eq(this.workflowJob.id, job.id))
        .returning()

      await this.appendEventWithDb(
        {
          workflowJobId: updatedJob.id,
          workflowAttemptId: claimedAttempt.id,
          eventType: WorkflowEventTypeEnum.ATTEMPT_CLAIMED,
          message: '工作流 attempt 已 claim',
          detail: {
            jobId: updatedJob.jobId,
            attemptId: claimedAttempt.attemptId,
            claimedBy: claimedAttempt.claimedBy,
          },
        },
        tx,
      )

      return { attempt: claimedAttempt, job: updatedJob }
    })
  }

  // 清理过期草稿。
  private async expireDraftJobs() {
    const now = new Date()
    const rows = await this.db
      .select()
      .from(this.workflowJob)
      .where(
        and(
          eq(this.workflowJob.status, WorkflowJobStatusEnum.DRAFT),
          lte(this.workflowJob.expiresAt, now),
        ),
      )
      .orderBy(asc(this.workflowJob.createdAt), asc(this.workflowJob.id))
      .limit(WORKFLOW_WORKER_BATCH_SIZE)

    for (const row of rows) {
      await this.expireDraftJob(row)
    }
  }

  // 过期单个草稿任务。
  private async expireDraftJob(row: WorkflowJobSelect) {
    const handler = this.registry.resolve(row.workflowType)
    await handler.cleanupExpiredDrafts?.(row.jobId)
    await this.drizzle.withTransaction(async (tx) => {
      const now = new Date()
      const [updated] = await tx
        .update(this.workflowJob)
        .set({
          status: WorkflowJobStatusEnum.EXPIRED,
          finishedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(this.workflowJob.id, row.id),
            eq(this.workflowJob.status, WorkflowJobStatusEnum.DRAFT),
          ),
        )
        .returning()
      if (!updated) {
        return
      }
      await this.releaseConflictKeys(row.id, tx, now)
      await this.appendEventWithDb(
        {
          workflowJobId: row.id,
          eventType: WorkflowEventTypeEnum.DRAFT_EXPIRED,
          message: '工作流草稿已过期',
          detail: { jobId: row.jobId },
        },
        tx,
      )
    })
  }

  // 创建 attempt。
  private async createAttemptWithDb(
    job: WorkflowJobSelect,
    triggerType: WorkflowAttemptTriggerTypeEnum,
    tx: Db,
    attemptNo?: number,
    selectedItemCount = job.selectedItemCount,
  ) {
    const now = new Date()
    const [attempt] = await tx
      .insert(this.workflowAttempt)
      .values({
        attemptId: randomUUID(),
        workflowJobId: job.id,
        attemptNo: attemptNo ?? (await this.resolveNextAttemptNo(job.id, tx)),
        triggerType,
        status: WorkflowAttemptStatusEnum.PENDING,
        selectedItemCount,
        successItemCount: 0,
        failedItemCount: 0,
        skippedItemCount: 0,
        claimedBy: null,
        claimExpiresAt: null,
        heartbeatAt: null,
        errorCode: null,
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    return attempt
  }

  // 解析下一个 attempt 序号。
  private async resolveNextAttemptNo(workflowJobId: bigint, tx: Db) {
    const rows = await tx
      .select({ attemptNo: this.workflowAttempt.attemptNo })
      .from(this.workflowAttempt)
      .where(eq(this.workflowAttempt.workflowJobId, workflowJobId))
      .orderBy(desc(this.workflowAttempt.attemptNo))
      .limit(1)
    return (rows.at(0)?.attemptNo ?? 0) + 1
  }

  // 读取工作流任务。
  private async readJob(jobId: string) {
    return this.readJobWithDb(jobId, this.db)
  }

  // 使用指定 db 读取工作流任务。
  private async readJobWithDb(jobId: string, db: Db) {
    const [row] = await db
      .select()
      .from(this.workflowJob)
      .where(eq(this.workflowJob.jobId, jobId))
      .limit(1)
    if (!row) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '工作流任务不存在',
      )
    }
    return row
  }

  // 使用内部 ID 读取工作流任务。
  private async readJobByIdWithDb(id: bigint, db: Db) {
    const [row] = await db
      .select()
      .from(this.workflowJob)
      .where(eq(this.workflowJob.id, id))
      .limit(1)
    if (!row) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '工作流任务不存在',
      )
    }
    return row
  }

  // 读取 attempt。
  private async readAttempt(id: bigint) {
    return this.readAttemptWithDb(id, this.db)
  }

  // 使用指定 db 读取 attempt。
  private async readAttemptWithDb(id: bigint, db: Db) {
    const [row] = await db
      .select()
      .from(this.workflowAttempt)
      .where(eq(this.workflowAttempt.id, id))
      .limit(1)
    if (!row) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '工作流 attempt 不存在',
      )
    }
    return row
  }

  // 使用公开 attemptId 读取 attempt。
  private async readAttemptByAttemptId(attemptId: string) {
    const [row] = await this.db
      .select()
      .from(this.workflowAttempt)
      .where(eq(this.workflowAttempt.attemptId, attemptId))
      .limit(1)
    if (!row) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '工作流 attempt 不存在',
      )
    }
    return row
  }

  // 读取任务历史冲突键。
  private async readJobConflictKeys(workflowJobId: bigint, db: Db) {
    const rows = await db
      .select({ conflictKey: this.workflowConflictKey.conflictKey })
      .from(this.workflowConflictKey)
      .where(eq(this.workflowConflictKey.workflowJobId, workflowJobId))
    return [...new Set(rows.map((row) => row.conflictKey))]
  }

  // 占用工作流冲突键。
  private async reserveConflictKeys(
    job: WorkflowJobSelect,
    conflictKeys: string[],
    tx: Db,
  ) {
    const now = new Date()
    for (const conflictKey of this.normalizeConflictKeys(conflictKeys)) {
      await tx.insert(this.workflowConflictKey).values({
        workflowJobId: job.id,
        workflowType: job.workflowType,
        conflictKey,
        releasedAt: null,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  // 释放任务仍占用的冲突键。
  private async releaseConflictKeys(workflowJobId: bigint, tx: Db, now: Date) {
    await tx
      .update(this.workflowConflictKey)
      .set({ releasedAt: now, updatedAt: now })
      .where(
        and(
          eq(this.workflowConflictKey.workflowJobId, workflowJobId),
          isNull(this.workflowConflictKey.releasedAt),
        ),
      )
  }

  // 取消待处理 attempt。
  private async cancelPendingAttempts(workflowJobId: bigint, tx: Db, now: Date) {
    await tx
      .update(this.workflowAttempt)
      .set({
        status: WorkflowAttemptStatusEnum.CANCELLED,
        finishedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(this.workflowAttempt.workflowJobId, workflowJobId),
          eq(this.workflowAttempt.status, WorkflowAttemptStatusEnum.PENDING),
        ),
      )
  }

  // 使用指定 db 追加事件。
  private async appendEventWithDb(input: AppendWorkflowEventInput, db: Db) {
    const [event] = await db
      .insert(this.workflowEvent)
      .values({
        workflowJobId: input.workflowJobId,
        workflowAttemptId: input.workflowAttemptId ?? null,
        eventType: input.eventType,
        message: input.message,
        detail: input.detail ?? null,
      })
      .returning()
    return event.id
  }

  // 构建执行上下文。
  private buildExecutionContext(
    job: WorkflowJobSelect,
    attempt: WorkflowAttemptSelect,
  ) {
    return {
      jobId: job.jobId,
      attemptId: attempt.attemptId,
      workflowType: job.workflowType,
      attemptNo: attempt.attemptNo,
      getStatus: async () => (await this.readJob(job.jobId)).status,
      isCancelRequested: async () =>
        (await this.readJob(job.jobId)).cancelRequestedAt !== null,
      assertNotCancelled: async () => {
        if ((await this.readJob(job.jobId)).cancelRequestedAt !== null) {
          throw new WorkflowCancellationError()
        }
      },
      assertStillOwned: async () => this.assertAttemptStillOwned(job, attempt),
      updateProgress: async (progress: WorkflowProgress) =>
        this.updateProgressForAttempt(job, attempt, progress),
      appendEvent: async (
        eventType: WorkflowEventTypeEnum,
        message: string,
        detail?: WorkflowObject,
      ) =>
        this.appendEvent({
          workflowJobId: job.id,
          workflowAttemptId: attempt.id,
          eventType,
          message,
          detail: detail ?? null,
        }),
    }
  }

  // 更新进度并续租。
  private async updateProgressForAttempt(
    job: WorkflowJobSelect,
    attempt: WorkflowAttemptSelect,
    progress: WorkflowProgress,
  ) {
    const now = new Date()
    const [updatedAttempt] = await this.db
      .update(this.workflowAttempt)
      .set({
        heartbeatAt: now,
        claimExpiresAt: this.buildClaimDeadline(now),
        updatedAt: now,
      })
      .where(
        and(
          eq(this.workflowAttempt.id, attempt.id),
          eq(this.workflowAttempt.status, WorkflowAttemptStatusEnum.RUNNING),
          eq(this.workflowAttempt.claimedBy, attempt.claimedBy ?? ''),
          gt(this.workflowAttempt.claimExpiresAt, now),
        ),
      )
      .returning()
    if (!updatedAttempt) {
      throw new WorkflowClaimLostError()
    }

    const percent = this.normalizeProgressPercent(progress.percent)
    await this.db
      .update(this.workflowJob)
      .set({
        progressPercent: percent,
        progressMessage: progress.message ?? null,
        updatedAt: now,
      })
      .where(eq(this.workflowJob.id, job.id))
    await this.appendEvent({
      workflowJobId: job.id,
      workflowAttemptId: attempt.id,
      eventType: WorkflowEventTypeEnum.PROGRESS_UPDATED,
      message: progress.message ?? '工作流进度已更新',
      detail: { percent },
    })
  }

  // 确认当前执行者仍持有 attempt 租约，供回滚和最终写入前阻断陈旧 worker。
  private async assertAttemptStillOwned(
    job: WorkflowJobSelect,
    attempt: WorkflowAttemptSelect,
  ) {
    const now = new Date()
    const latestAttempt = await this.readAttempt(attempt.id)
    const latestJob = await this.readJobByIdWithDb(job.id, this.db)
    if (
      latestJob.status !== WorkflowJobStatusEnum.RUNNING ||
      latestJob.currentAttemptFk !== attempt.id ||
      latestAttempt.status !== WorkflowAttemptStatusEnum.RUNNING ||
      latestAttempt.claimedBy !== attempt.claimedBy ||
      !latestAttempt.claimExpiresAt ||
      latestAttempt.claimExpiresAt <= now
    ) {
      throw new WorkflowClaimLostError()
    }
  }

  // 根据 attempt 终态聚合 job 终态。
  private resolveJobStatusFromAttempt(attempt: WorkflowAttemptSelect) {
    if (attempt.status === WorkflowAttemptStatusEnum.SUCCESS) {
      return WorkflowJobStatusEnum.SUCCESS
    }
    if (attempt.status === WorkflowAttemptStatusEnum.PARTIAL_FAILED) {
      return WorkflowJobStatusEnum.PARTIAL_FAILED
    }
    if (attempt.status === WorkflowAttemptStatusEnum.CANCELLED) {
      return WorkflowJobStatusEnum.CANCELLED
    }
    return attempt.successItemCount > 0
      ? WorkflowJobStatusEnum.PARTIAL_FAILED
      : WorkflowJobStatusEnum.FAILED
  }

  // 根据内容导入聚合计数解析 attempt 终态。
  private resolveAttemptStatusFromCounters(counters: WorkflowStatusCounters) {
    if (counters.failedItemCount === 0) {
      return WorkflowAttemptStatusEnum.SUCCESS
    }
    return counters.successItemCount > 0
      ? WorkflowAttemptStatusEnum.PARTIAL_FAILED
      : WorkflowAttemptStatusEnum.FAILED
  }

  // 根据内容导入聚合计数解析 job 终态。
  private resolveJobStatusFromCounters(counters: WorkflowStatusCounters) {
    if (counters.failedItemCount === 0) {
      return WorkflowJobStatusEnum.SUCCESS
    }
    return counters.successItemCount > 0
      ? WorkflowJobStatusEnum.PARTIAL_FAILED
      : WorkflowJobStatusEnum.FAILED
  }

  // 无业务恢复钩子时的保守恢复结果。
  private buildDefaultExpiredAttemptRecovery(
    job: WorkflowJobSelect,
    attempt: WorkflowAttemptSelect,
  ): WorkflowExpiredAttemptRecoveryResult {
    return {
      selectedItemCount: job.selectedItemCount,
      successItemCount: 0,
      failedItemCount: attempt.selectedItemCount,
      skippedItemCount: 0,
      recoverableItemCount: 0,
    }
  }

  // 判断任务状态是否终态。
  private isTerminalJobStatus(status: number) {
    return (WORKFLOW_TERMINAL_JOB_STATUSES as readonly WorkflowJobStatusEnum[])
      .includes(status as WorkflowJobStatusEnum)
  }

  // 归一化操作者。
  private normalizeOperator(operator: CreateWorkflowJobInput['operator']) {
    if (operator.type === WorkflowOperatorTypeEnum.ADMIN) {
      if (!Number.isInteger(operator.userId) || operator.userId <= 0) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '工作流管理员操作者ID非法',
        )
      }
      return {
        operatorType: WorkflowOperatorTypeEnum.ADMIN,
        operatorUserId: operator.userId,
      }
    }
    return {
      operatorType: WorkflowOperatorTypeEnum.SYSTEM,
      operatorUserId: null,
    }
  }

  // 归一化必填文本。
  private normalizeRequiredText(value: string, label: string) {
    const normalized = value.trim()
    if (!normalized) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `${label}不能为空`,
      )
    }
    return normalized
  }

  // 归一化业务冲突键。
  private normalizeConflictKeys(keys: string[]) {
    const normalizedKeys: string[] = []
    const seenKeys = new Set<string>()
    for (const key of keys) {
      const normalizedKey = this.normalizeRequiredText(key, '工作流冲突键')
      if (seenKeys.has(normalizedKey)) {
        continue
      }
      seenKeys.add(normalizedKey)
      normalizedKeys.push(normalizedKey)
    }
    return normalizedKeys
  }

  // 归一化进度百分比。
  private normalizeProgressPercent(value: number | undefined) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 0
    }
    return Math.min(100, Math.max(0, Math.floor(value)))
  }

  // 构建 claim 过期时间。
  private buildClaimDeadline(now = new Date()) {
    const deadline = new Date(now)
    deadline.setSeconds(
      deadline.getSeconds() + WORKFLOW_CLAIM_TIMEOUT_SECONDS,
    )
    return deadline
  }

  // 构建 worker 标识。
  private buildWorkerId() {
    return `workflow-worker-${process.pid}`
  }

  // 转换数据库行为接口 DTO。
  private toJobDto(row: WorkflowJobSelect) {
    return {
      id: Number(row.id),
      jobId: row.jobId,
      workflowType: row.workflowType,
      displayName: row.displayName,
      operatorType: row.operatorType,
      operatorUserId: row.operatorUserId,
      status: this.normalizeJobStatus(row.status),
      progressPercent: row.progressPercent,
      progressMessage: row.progressMessage,
      selectedItemCount: row.selectedItemCount,
      successItemCount: row.successItemCount,
      failedItemCount: row.failedItemCount,
      skippedItemCount: row.skippedItemCount,
      cancelRequestedAt: row.cancelRequestedAt,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      expiresAt: row.expiresAt,
      summary: this.asNullableObject(row.summary),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  // 转换 attempt DTO。
  private toAttemptDto(row: WorkflowAttemptSelect) {
    return {
      id: Number(row.id),
      attemptId: row.attemptId,
      attemptNo: row.attemptNo,
      triggerType: row.triggerType,
      status: this.normalizeAttemptStatus(row.status),
      selectedItemCount: row.selectedItemCount,
      successItemCount: row.successItemCount,
      failedItemCount: row.failedItemCount,
      skippedItemCount: row.skippedItemCount,
      claimedBy: row.claimedBy,
      claimExpiresAt: row.claimExpiresAt,
      heartbeatAt: row.heartbeatAt,
      errorCode: row.errorCode,
      errorMessage: row.errorMessage,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  // 转换事件 DTO。
  private toEventDto(row: WorkflowEventSelect) {
    return {
      id: Number(row.id),
      eventType: row.eventType,
      message: row.message,
      detail: this.asNullableObject(row.detail),
      createdAt: row.createdAt,
    }
  }

  // 归一化 job 状态。
  private normalizeJobStatus(status: number) {
    if (
      Object.values(WorkflowJobStatusEnum).includes(
        status as WorkflowJobStatusEnum,
      )
    ) {
      return status as WorkflowJobStatusEnum
    }
    throw new BusinessException(
      BusinessErrorCode.STATE_CONFLICT,
      '工作流任务状态非法',
    )
  }

  // 归一化 attempt 状态。
  private normalizeAttemptStatus(status: number) {
    if (
      Object.values(WorkflowAttemptStatusEnum).includes(
        status as WorkflowAttemptStatusEnum,
      )
    ) {
      return status as WorkflowAttemptStatusEnum
    }
    throw new BusinessException(
      BusinessErrorCode.STATE_CONFLICT,
      '工作流 attempt 状态非法',
    )
  }

  // 转换未知值为可空对象。
  private asNullableObject(value: unknown) {
    return value === null || value === undefined ? null : this.asObject(value)
  }

  // 转换未知值为对象。
  private asObject(value: unknown): WorkflowObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as WorkflowObject)
      : {}
  }

  // 转换错误为结构化对象。
  private toErrorObject(error: unknown) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
      }
    }
    return {
      name: 'UnknownError',
      message: this.stringifyError(error),
    }
  }

  // 转换错误文本。
  private stringifyError(error: unknown) {
    if (typeof error === 'string') {
      return error
    }
    try {
      return JSON.stringify(error)
    } catch {
      return 'unknown error'
    }
  }

  // 转换数据库异常。
  private handleDatabaseError(
    error: unknown,
    messages: WorkflowDatabaseErrorMessages,
  ): never {
    const source =
      error instanceof Error || (typeof error === 'object' && error !== null)
        ? error
        : undefined
    this.drizzle.handleError(source as PostgresErrorSource, messages)
  }
}
