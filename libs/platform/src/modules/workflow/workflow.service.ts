import type { Db } from '@db/core'
import type {
  WorkflowAttemptSelect,
  WorkflowJobSelect,
} from '@db/schema'
import type { SQL } from 'drizzle-orm'
import type {
  AppendWorkflowEventInput,
  CompleteCurrentWorkflowAttemptInput,
  CompleteCurrentWorkflowAttemptWithDelayedRetryInput,
  CompleteWorkflowAttemptByAttemptIdInput,
  CompleteWorkflowAttemptInput,
  CompleteWorkflowAttemptWithDelayedRetryByAttemptIdInput,
  CompleteWorkflowAttemptWithDelayedRetryInput,
  CreateWorkflowDraftResourceInitializer,
  CreateWorkflowJobInput,
  WorkflowNotificationRow,
  WorkflowObject,
  WorkflowProgress,
} from './workflow.type'
import { randomUUID } from 'node:crypto'
import process from 'node:process'
import { DrizzleService, toPageResult } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, Logger } from '@nestjs/common'
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lte, or, sql } from 'drizzle-orm'
import {
  WorkflowArchiveDto,
  WorkflowExpireDto,
  WorkflowItemPageRequestDto,
  WorkflowJobIdDto,
  WorkflowJobPageRequestDto,
  WorkflowNotificationItemDto,
  WorkflowNotificationListRequestDto,
  WorkflowRecordPageRequestDto,
  WorkflowRetryItemsDto,
} from './dto'
import {
  WorkflowCancellationError,
  WorkflowCancellationSignal,
} from './workflow-cancellation'
import { normalizeWorkflowConflictKeys } from './workflow-conflict-key'
import {
  createWorkflowErrorFacts,
  createWorkflowErrorFactsByCode,
  normalizeUnknownWorkflowError,
  toWorkflowErrorColumns,
  WorkflowErrorCodeEnum,
} from './workflow-error-facts'
import { DEFAULT_WORKFLOW_RECORD_EVENT_TYPES } from './workflow-record-policy'
import {
  buildDefaultExpiredAttemptRecovery,
  buildWorkflowClaimDeadline,
  isTerminalWorkflowJobStatus,
  isWorkflowAttemptDue,
  normalizeWorkflowOperator,
  normalizeWorkflowProgressPercent,
  normalizeWorkflowRequiredText,
  resolveAttemptStatusFromCounters,
  resolveJobStatusFromCounters,
} from './workflow-runtime-policy'
import {
  WORKFLOW_LEASE_RENEW_INTERVAL_SECONDS,
  WORKFLOW_RETRYABLE_JOB_STATUSES,
  WORKFLOW_WORKER_BATCH_SIZE,
  WorkflowAttemptStatusEnum,
  WorkflowAttemptTriggerTypeEnum,
  WorkflowEventTypeEnum,
  WorkflowJobArchiveScopeEnum,
  WorkflowJobStatusEnum,
  WorkflowNotificationKindEnum,
} from './workflow.constant'
import {
  normalizeWorkflowJobStatus,
  toWorkflowAttemptDto,
  toWorkflowErrorObject,
  toWorkflowJobDto,
  toWorkflowRecordDto,
} from './workflow.mapper'
import { WorkflowRegistry } from './workflow.registry'

class WorkflowClaimLostError extends Error {
  constructor() {
    super('工作流 attempt claim 已丢失')
    this.name = 'WorkflowClaimLostError'
  }
}

const DEFAULT_WORKFLOW_NOTIFICATION_LIMIT = 20
const MAX_WORKFLOW_NOTIFICATION_LIMIT = 50

function isWorkflowClaimLostError(error: unknown) {
  return (
    error instanceof WorkflowClaimLostError ||
    (error instanceof Error && error.name === 'WorkflowClaimLostError')
  )
}

function normalizeWorkflowNotificationLimit(limit?: number) {
  return Math.min(
    Math.max(limit ?? DEFAULT_WORKFLOW_NOTIFICATION_LIMIT, 1),
    MAX_WORKFLOW_NOTIFICATION_LIMIT,
  )
}

function normalizeWorkflowNotificationKinds(kinds?: WorkflowNotificationKindEnum[]) {
  const normalized = kinds?.length
    ? kinds
    : [
        WorkflowNotificationKindEnum.SUCCESS,
        WorkflowNotificationKindEnum.RETRYING,
        WorkflowNotificationKindEnum.FAILED,
      ]
  return new Set(normalized)
}

function resolveNotificationEventTypes(kinds: Set<WorkflowNotificationKindEnum>) {
  const eventTypes = new Set<WorkflowEventTypeEnum>()
  if (
    kinds.has(WorkflowNotificationKindEnum.SUCCESS) ||
    kinds.has(WorkflowNotificationKindEnum.FAILED)
  ) {
    eventTypes.add(WorkflowEventTypeEnum.ATTEMPT_COMPLETED)
  }
  if (kinds.has(WorkflowNotificationKindEnum.RETRYING)) {
    eventTypes.add(WorkflowEventTypeEnum.RETRY_REQUESTED)
  }
  return [...eventTypes]
}

function resolveWorkflowNotificationKind(row: WorkflowNotificationRow) {
  if (
    row.event.eventType === WorkflowEventTypeEnum.RETRY_REQUESTED &&
    row.attempt.triggerType === WorkflowAttemptTriggerTypeEnum.SYSTEM_RECOVERY
  ) {
    return WorkflowNotificationKindEnum.RETRYING
  }

  if (
    row.event.eventType !== WorkflowEventTypeEnum.ATTEMPT_COMPLETED ||
    row.event.workflowAttemptId !== row.job.currentAttemptFk
  ) {
    return null
  }

  if (row.job.status === WorkflowJobStatusEnum.SUCCESS) {
    return WorkflowNotificationKindEnum.SUCCESS
  }
  if (
    row.job.status === WorkflowJobStatusEnum.PARTIAL_FAILED ||
    row.job.status === WorkflowJobStatusEnum.FAILED
  ) {
    return WorkflowNotificationKindEnum.FAILED
  }
  return null
}

function isWorkflowNotificationItem(
  item: WorkflowNotificationItemDto | null,
  kinds: Set<WorkflowNotificationKindEnum>,
): item is WorkflowNotificationItemDto {
  return item !== null && kinds.has(item.kind)
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
          eventCode: 'WORKFLOW_JOB_CREATED',
          detail: { jobId: row.jobId, workflowType: row.workflowType },
        },
        tx,
      )
      return toWorkflowJobDto(row)
    })
  }

  // 创建草稿工作流任务，并在同一事务内初始化领域资源。
  async createDraftWithResources(
    input: CreateWorkflowJobInput,
    initializeResources: CreateWorkflowDraftResourceInitializer,
  ) {
    return this.drizzle.withTransaction(async (tx) => {
      const row = await this.createDraftWithDb(input, tx)
      await initializeResources({ tx, workflowJob: row })
      await this.appendEventWithDb(
        {
          workflowJobId: row.id,
          eventType: WorkflowEventTypeEnum.JOB_CREATED,
          eventCode: 'WORKFLOW_JOB_CREATED',
          detail: { jobId: row.jobId, workflowType: row.workflowType },
        },
        tx,
      )
      return toWorkflowJobDto(row)
    })
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
          eventCode: 'WORKFLOW_JOB_CONFIRMED',
          detail: { jobId: job.jobId, attemptId: attempt.attemptId },
        },
        tx,
      )

      return toWorkflowJobDto(updatedJob)
    })
  }

  // 分页查询工作流通用条目。
  async getItemPage(input: WorkflowItemPageRequestDto) {
    if (!input.jobId) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '工作流任务ID不能为空',
      )
    }
    const job = await this.readJob(input.jobId)
    const handler = this.registry.resolve(job.workflowType)
    if (!handler.getItemPage) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `工作流条目读取器不存在: ${job.workflowType}`,
      )
    }
    return handler.getItemPage({
      jobId: job.jobId,
      workflowType: job.workflowType,
      query: input,
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
    if (input.archiveScope === WorkflowJobArchiveScopeEnum.ARCHIVED) {
      conditions.push(isNotNull(this.workflowJob.archivedAt))
    } else if (input.archiveScope !== WorkflowJobArchiveScopeEnum.ALL) {
      conditions.push(isNull(this.workflowJob.archivedAt))
    }

    const where = conditions.length ? and(...conditions) : undefined
    const page = this.drizzle.buildPage(input)
    const orderQuery = this.drizzle.buildOrderBy(
      input.orderBy?.trim()
        ? input.orderBy
        : { updatedAt: 'desc', id: 'desc' },
      { table: this.workflowJob },
    )
    const [list, total] = await Promise.all([
      this.db
        .select()
        .from(this.workflowJob)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.workflowJob, where),
    ])
    const pageResult = toPageResult(list, total, page)

    return {
      ...pageResult,
      list: pageResult.list.map((row) => toWorkflowJobDto(row)),
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

    return {
      ...toWorkflowJobDto(job),
      attempts: attempts.map((attempt) => toWorkflowAttemptDto(attempt)),
    }
  }

  // 归档终态工作流任务，仅从默认列表隐藏，不触发清理或生命周期变更。
  async archiveJob(input: WorkflowArchiveDto) {
    return this.drizzle.withTransaction(async (tx) => {
      const job = await this.readJobWithDb(input.jobId, tx)
      if (!isTerminalWorkflowJobStatus(job.status)) {
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          '只有终态工作流任务可以归档',
        )
      }

      if (job.archivedAt) {
        return toWorkflowJobDto(job)
      }

      const now = new Date()
      const [updatedJob] = await tx
        .update(this.workflowJob)
        .set({
          archivedAt: now,
          updatedAt: now,
        })
        .where(eq(this.workflowJob.id, job.id))
        .returning()

      return toWorkflowJobDto(updatedJob)
    })
  }

  // 分页查询工作流处理记录。
  async getJobRecordPage(input: WorkflowRecordPageRequestDto) {
    const job = await this.readJob(input.jobId)
    const attempt = input.attemptId
      ? await this.readAttemptByAttemptId(input.attemptId)
      : null
    const eventTypes = input.eventTypes?.length
      ? input.eventTypes
      : [...DEFAULT_WORKFLOW_RECORD_EVENT_TYPES]
    const conditions: SQL[] = [
      eq(this.workflowEvent.workflowJobId, job.id),
      inArray(this.workflowEvent.eventType, eventTypes),
    ]

    if (attempt) {
      conditions.push(eq(this.workflowEvent.workflowAttemptId, attempt.id))
    }

    const where = and(...conditions)
    const page = this.drizzle.buildPage(input)
    const orderQuery = this.drizzle.buildOrderBy(
      input.orderBy?.trim()
        ? input.orderBy
        : { createdAt: 'desc', id: 'desc' },
      { table: this.workflowEvent },
    )
    const [list, total] = await Promise.all([
      this.db
        .select()
        .from(this.workflowEvent)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.workflowEvent, where),
    ])
    const pageResult = toPageResult(list, total, page)
    const attemptIds = [
      ...new Set(
        pageResult.list
          .map((event) => event.workflowAttemptId)
          .filter((id): id is bigint => id !== null),
      ),
    ]
    const attempts = await this.readAttemptsByInternalIds(attemptIds)

    return {
      ...pageResult,
      list: pageResult.list.map((event) =>
        toWorkflowRecordDto(
          event,
          event.workflowAttemptId
            ? attempts.get(event.workflowAttemptId)
            : undefined,
        ),
      ),
    }
  }

  // 查询后台全局工作流通知事实。
  async getNotificationList(input: WorkflowNotificationListRequestDto) {
    const limit = normalizeWorkflowNotificationLimit(input.limit)
    const kinds = normalizeWorkflowNotificationKinds(input.kinds)
    const conditions: SQL[] = [
      isNull(this.workflowJob.archivedAt),
      inArray(this.workflowEvent.eventType, resolveNotificationEventTypes(kinds)),
    ]
    const projectionCondition = this.buildNotificationProjectionCondition(kinds)
    if (projectionCondition) {
      conditions.push(projectionCondition)
    }
    if (input.createdAfter) {
      conditions.push(this.buildNotificationCursorCondition(input))
    }

    const rows = await this.db
      .select({
        attempt: {
          triggerType: this.workflowAttempt.triggerType,
          notBeforeAt: this.workflowAttempt.notBeforeAt,
        },
        event: {
          id: this.workflowEvent.id,
          eventType: this.workflowEvent.eventType,
          workflowAttemptId: this.workflowEvent.workflowAttemptId,
          createdAt: this.workflowEvent.createdAt,
        },
        job: {
          jobId: this.workflowJob.jobId,
          workflowType: this.workflowJob.workflowType,
          displayName: this.workflowJob.displayName,
          status: this.workflowJob.status,
          currentAttemptFk: this.workflowJob.currentAttemptFk,
          selectedItemCount: this.workflowJob.selectedItemCount,
          successItemCount: this.workflowJob.successItemCount,
          failedItemCount: this.workflowJob.failedItemCount,
          skippedItemCount: this.workflowJob.skippedItemCount,
          archivedAt: this.workflowJob.archivedAt,
          updatedAt: this.workflowJob.updatedAt,
        },
      })
      .from(this.workflowEvent)
      .innerJoin(
        this.workflowJob,
        eq(this.workflowEvent.workflowJobId, this.workflowJob.id),
      )
      .innerJoin(
        this.workflowAttempt,
        eq(this.workflowEvent.workflowAttemptId, this.workflowAttempt.id),
      )
      .where(and(...conditions))
      .orderBy(asc(this.workflowEvent.createdAt), asc(this.workflowEvent.id))
      .limit(limit)

    const list = rows
      .map((row) => this.toWorkflowNotificationItem(row))
      .filter((item) => isWorkflowNotificationItem(item, kinds))
    const last = list.at(-1)

    return {
      list,
      nextAfterId: last?.id ?? null,
      nextCreatedAfter: last?.createdAt ?? null,
      serverTime: new Date(),
    }
  }

  // 请求取消工作流任务。
  async cancelJob(input: WorkflowJobIdDto) {
    return this.drizzle.withTransaction(async (tx) => {
      const job = await this.readJobWithDb(input.jobId, tx)
      if (isTerminalWorkflowJobStatus(job.status)) {
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
          progressDetail: null,
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
          eventCode: 'WORKFLOW_CANCEL_REQUESTED',
          detail: { jobId: job.jobId },
        },
        tx,
      )
      return toWorkflowJobDto(updatedJob)
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
      const retryPreparation = await handler.prepareRetry?.(
        {
          jobId: job.jobId,
          workflowType: job.workflowType,
          selectedItemIds: input.itemIds,
          conflictKeys,
        },
        nextAttemptNo,
        tx,
      )
      if (!retryPreparation) {
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          '工作流处理器未返回重试后的任务计数',
        )
      }

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
          archivedAt: null,
          cancelRequestedAt: null,
          progressDetail: null,
          finishedAt: null,
          successItemCount: retryPreparation.jobCounters.successItemCount,
          failedItemCount: retryPreparation.jobCounters.failedItemCount,
          skippedItemCount: retryPreparation.jobCounters.skippedItemCount,
          updatedAt: new Date(),
        })
        .where(eq(this.workflowJob.id, job.id))
        .returning()

      await this.appendEventWithDb(
        {
          workflowJobId: job.id,
          workflowAttemptId: attempt.id,
          eventType: WorkflowEventTypeEnum.RETRY_REQUESTED,
          eventCode: 'WORKFLOW_MANUAL_RETRY_ATTEMPT_CREATED',
          detail: {
            jobId: job.jobId,
            attemptId: attempt.attemptId,
            itemIds: input.itemIds,
          },
        },
        tx,
      )
      return toWorkflowJobDto(updatedJob)
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
          progressDetail: null,
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
          eventCode: 'WORKFLOW_RETAINED_RESOURCE_CLEANED',
          detail: { jobId: job.jobId },
        },
        tx,
      )
      return toWorkflowJobDto(updatedJob)
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
      const errorColumns = toWorkflowErrorColumns(input.error, input.errorDiagnostic)
      const [updatedAttempt] = await tx
        .update(this.workflowAttempt)
        .set({
          status: input.status,
          successItemCount: input.attemptCounters.successItemCount,
          failedItemCount: input.attemptCounters.failedItemCount,
          skippedItemCount: input.attemptCounters.skippedItemCount,
          ...errorColumns,
          claimedBy: null,
          claimExpiresAt: null,
          heartbeatAt: now,
          finishedAt: now,
          updatedAt: now,
        })
        .where(this.buildAttemptCompletionWhere(attempt, input, now))
        .returning()
      if (!updatedAttempt) {
        this.logWorkflowLeaseLost(
          job,
          {
            ...attempt,
            claimedBy: input.completionOwnerClaimedBy ?? attempt.claimedBy,
          },
          new WorkflowClaimLostError(),
        )
        return
      }

      const jobStatus = resolveJobStatusFromCounters(input.jobCounters)
      const [updatedJob] = await tx
        .update(this.workflowJob)
        .set({
          status: jobStatus,
          progressDetail: null,
          progressPercent:
            jobStatus === WorkflowJobStatusEnum.SUCCESS ? 100 : job.progressPercent,
          successItemCount: input.jobCounters.successItemCount,
          failedItemCount: input.jobCounters.failedItemCount,
          skippedItemCount: input.jobCounters.skippedItemCount,
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
          eventCode: 'WORKFLOW_ATTEMPT_COMPLETED',
          detail: {
            jobId: job.jobId,
            attemptId: attempt.attemptId,
            status: input.status,
          },
        },
        tx,
      )
      return toWorkflowJobDto(updatedJob)
    })
  }

  // 使用公开 attemptId 完成 attempt 并聚合 job 状态。
  async completeAttemptByAttemptId(input: CompleteWorkflowAttemptByAttemptIdInput) {
    const attempt = await this.readAttemptByAttemptId(input.attemptId)
    const job = await this.readJobByIdWithDb(attempt.workflowJobId, this.db)
    if (
      !(await this.tryAssertAttemptStillOwned(job, {
        ...attempt,
        claimedBy: input.completionOwnerClaimedBy,
      }))
    ) {
      return
    }
    return this.completeAttempt({
      workflowAttemptId: attempt.id,
      status: input.status,
      jobCounters: input.jobCounters,
      attemptCounters: input.attemptCounters,
      completionOwnerClaimedBy: input.completionOwnerClaimedBy,
      error: input.error,
      errorDiagnostic: input.errorDiagnostic,
    })
  }

  // 完成当前 attempt，并创建到点后继续执行的系统 attempt。
  async completeAttemptWithDelayedRetry(
    input: CompleteWorkflowAttemptWithDelayedRetryInput,
  ) {
    return this.drizzle.withTransaction(async (tx) => {
      const attempt = await this.readAttemptWithDb(input.workflowAttemptId, tx)
      const job = await this.readJobByIdWithDb(attempt.workflowJobId, tx)
      const now = new Date()
      const errorColumns = toWorkflowErrorColumns(input.error, input.errorDiagnostic)
      const [updatedAttempt] = await tx
        .update(this.workflowAttempt)
        .set({
          status: input.status,
          successItemCount: input.attemptCounters.successItemCount,
          failedItemCount: input.attemptCounters.failedItemCount,
          skippedItemCount: input.attemptCounters.skippedItemCount,
          ...errorColumns,
          claimedBy: null,
          claimExpiresAt: null,
          heartbeatAt: now,
          finishedAt: now,
          updatedAt: now,
        })
        .where(this.buildAttemptCompletionWhere(attempt, input, now))
        .returning()
      if (!updatedAttempt) {
        this.logWorkflowLeaseLost(
          job,
          {
            ...attempt,
            claimedBy: input.completionOwnerClaimedBy ?? attempt.claimedBy,
          },
          new WorkflowClaimLostError(),
        )
        return
      }
      const delayedAttempt = await this.createAttemptWithDb(
        job,
        WorkflowAttemptTriggerTypeEnum.SYSTEM_RECOVERY,
        tx,
        await this.resolveNextAttemptNo(job.id, tx),
        input.delayedSelectedItemCount,
        input.nextRetryAt,
      )
      const [updatedJob] = await tx
        .update(this.workflowJob)
        .set({
          status: WorkflowJobStatusEnum.PENDING,
          currentAttemptFk: delayedAttempt.id,
          progressDetail: null,
          successItemCount: input.jobCounters.successItemCount,
          failedItemCount: input.jobCounters.failedItemCount,
          skippedItemCount: input.jobCounters.skippedItemCount,
          finishedAt: null,
          updatedAt: now,
        })
        .where(eq(this.workflowJob.id, job.id))
        .returning()
      await this.appendEventWithDb(
        {
          workflowJobId: job.id,
          workflowAttemptId: updatedAttempt.id,
          eventType: WorkflowEventTypeEnum.ATTEMPT_COMPLETED,
          eventCode: 'WORKFLOW_ATTEMPT_DELAYED_RETRY_SCHEDULED',
          detail: {
            jobId: job.jobId,
            attemptId: attempt.attemptId,
            status: input.status,
            nextRetryAt: input.nextRetryAt.toISOString(),
          },
        },
        tx,
      )
      await this.appendEventWithDb(
        {
          workflowJobId: job.id,
          workflowAttemptId: delayedAttempt.id,
          eventType: WorkflowEventTypeEnum.RETRY_REQUESTED,
          eventCode: 'WORKFLOW_DELAYED_RETRY_ATTEMPT_CREATED',
          detail: {
            jobId: job.jobId,
            attemptId: delayedAttempt.attemptId,
            notBeforeAt: input.nextRetryAt.toISOString(),
          },
        },
        tx,
      )
      return toWorkflowJobDto(updatedJob)
    })
  }

  // 使用公开 attemptId 完成当前 attempt，并创建延后 retry attempt。
  async completeAttemptWithDelayedRetryByAttemptId(
    input: CompleteWorkflowAttemptWithDelayedRetryByAttemptIdInput,
  ) {
    const attempt = await this.readAttemptByAttemptId(input.attemptId)
    const job = await this.readJobByIdWithDb(attempt.workflowJobId, this.db)
    if (
      !(await this.tryAssertAttemptStillOwned(job, {
        ...attempt,
        claimedBy: input.completionOwnerClaimedBy,
      }))
    ) {
      return
    }
    return this.completeAttemptWithDelayedRetry({
      workflowAttemptId: attempt.id,
      status: input.status,
      jobCounters: input.jobCounters,
      attemptCounters: input.attemptCounters,
      completionOwnerClaimedBy: input.completionOwnerClaimedBy,
      error: input.error,
      errorDiagnostic: input.errorDiagnostic,
      nextRetryAt: input.nextRetryAt,
      delayedSelectedItemCount: input.delayedSelectedItemCount,
    })
  }

  // 消费待处理工作流 attempt。
  async consumePendingAttempts() {
    await this.expireDraftJobs()
    await this.recoverExpiredRunningAttempts()
    const now = new Date()
    const pendingAttempts = await this.db
      .select()
      .from(this.workflowAttempt)
      .where(
        and(
          eq(this.workflowAttempt.status, WorkflowAttemptStatusEnum.PENDING),
          or(
            isNull(this.workflowAttempt.notBeforeAt),
            lte(this.workflowAttempt.notBeforeAt, now),
          ),
        ),
      )
      .orderBy(asc(this.workflowAttempt.createdAt), asc(this.workflowAttempt.id))
      .limit(WORKFLOW_WORKER_BATCH_SIZE)

    for (const attempt of pendingAttempts.filter((attempt) =>
      isWorkflowAttemptDue(attempt, now),
    )) {
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

      const expiredError = createWorkflowErrorFactsByCode(
        WorkflowErrorCodeEnum.ATTEMPT_LEASE_EXPIRED,
        {
          attemptId: attempt.attemptId,
          claimExpiresAt: attempt.claimExpiresAt?.toISOString(),
          jobId: job.jobId,
          recoveredAt: now.toISOString(),
        },
      )
      const [expiredAttempt] = await tx
        .update(this.workflowAttempt)
        .set({
          status: WorkflowAttemptStatusEnum.FAILED,
          claimedBy: null,
          claimExpiresAt: null,
          heartbeatAt: now,
          ...toWorkflowErrorColumns(expiredError),
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
        buildDefaultExpiredAttemptRecovery(job, attempt)

      const expiredStatus =
        recovery.recoverableItemCount > 0
          ? WorkflowAttemptStatusEnum.FAILED
          : resolveAttemptStatusFromCounters(recovery.attemptCounters)
      await tx
        .update(this.workflowAttempt)
        .set({
          status: expiredStatus,
          successItemCount: recovery.attemptCounters.successItemCount,
          failedItemCount: recovery.attemptCounters.failedItemCount,
          skippedItemCount: recovery.attemptCounters.skippedItemCount,
          ...toWorkflowErrorColumns(
            expiredStatus === WorkflowAttemptStatusEnum.SUCCESS
              ? null
              : createWorkflowErrorFacts({
                  ...expiredError,
                  context: {
                    ...expiredError.context,
                    recoverableItemCount: recovery.recoverableItemCount,
                    status: expiredStatus,
                  },
                }),
          ),
          updatedAt: now,
        })
        .where(eq(this.workflowAttempt.id, expiredAttempt.id))

      await this.appendEventWithDb(
        {
          workflowJobId: job.id,
          workflowAttemptId: expiredAttempt.id,
          eventType: WorkflowEventTypeEnum.ATTEMPT_COMPLETED,
          eventCode: 'WORKFLOW_ATTEMPT_LEASE_RECOVERED',
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
            progressDetail: null,
            successItemCount: recovery.jobCounters.successItemCount,
            failedItemCount: recovery.jobCounters.failedItemCount,
            skippedItemCount: recovery.jobCounters.skippedItemCount,
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
            eventCode: 'WORKFLOW_SYSTEM_RECOVERY_ATTEMPT_CREATED',
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

      const terminalStatus = resolveJobStatusFromCounters(recovery.jobCounters)
      const [updatedJob] = await tx
        .update(this.workflowJob)
        .set({
          status: terminalStatus,
          progressDetail: null,
          progressPercent:
            terminalStatus === WorkflowJobStatusEnum.SUCCESS
              ? 100
              : job.progressPercent,
          successItemCount: recovery.jobCounters.successItemCount,
          failedItemCount: recovery.jobCounters.failedItemCount,
          skippedItemCount: recovery.jobCounters.skippedItemCount,
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
    const operator = normalizeWorkflowOperator(input.operator)
    const displayName = normalizeWorkflowRequiredText(input.displayName, '展示名称')
    const workflowType = normalizeWorkflowRequiredText(
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
        progressPercent: normalizeWorkflowProgressPercent(input.progress?.percent),
        progressCode: input.progress?.code ?? null,
        progressContext: input.progress?.context ?? null,
        progressDetail: input.progress?.detail ?? null,
        currentAttemptFk: null,
        selectedItemCount: input.selectedItemCount ?? 0,
        successItemCount: 0,
        failedItemCount: 0,
        skippedItemCount: 0,
        archivedAt: null,
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
    const leaseKeeper = this.startAttemptLeaseKeeper(job, attempt)
    try {
      await handler.execute(this.buildExecutionContext(job, attempt))
      leaseKeeper.assertHealthy()
      if (!(await this.tryAssertAttemptStillOwned(job, attempt))) {
        return
      }
      const latestAttempt = await this.readAttempt(attempt.id)
      if (latestAttempt.status === WorkflowAttemptStatusEnum.RUNNING) {
        const latestJob = await this.readJobByIdWithDb(job.id, this.db)
        const attemptCounters = {
          successItemCount: latestAttempt.selectedItemCount,
          failedItemCount: 0,
          skippedItemCount: 0,
        }
        const jobCounters = {
          successItemCount:
            latestJob.successItemCount + attemptCounters.successItemCount,
          failedItemCount: latestJob.failedItemCount,
          skippedItemCount: latestJob.skippedItemCount,
        }
        await this.completeAttempt({
          workflowAttemptId: attempt.id,
          status: WorkflowAttemptStatusEnum.SUCCESS,
          jobCounters,
          attemptCounters,
          completionOwnerClaimedBy: attempt.claimedBy ?? '',
        })
      }
    } catch (error) {
      if (isWorkflowClaimLostError(error)) {
        return
      }
      if (!this.isLeaseKeeperHealthy(leaseKeeper)) {
        return
      }
      const fallbackAttemptCounters = {
        successItemCount: 0,
        failedItemCount: attempt.selectedItemCount,
        skippedItemCount: 0,
      }
      const latestJob = await this.readJobByIdWithDb(job.id, this.db)
      const fallbackJobCounters = {
        successItemCount: latestJob.successItemCount,
        failedItemCount: latestJob.failedItemCount + fallbackAttemptCounters.failedItemCount,
        skippedItemCount: latestJob.skippedItemCount,
      }
      const isCountedCancellation = error instanceof WorkflowCancellationError
      const jobCounters = isCountedCancellation ? error.jobCounters : fallbackJobCounters
      const attemptCounters = isCountedCancellation
        ? error.attemptCounters
        : fallbackAttemptCounters
      const errorObject = toWorkflowErrorObject(error)
      const errorFacts = normalizeUnknownWorkflowError(error, {
        attemptId: attempt.attemptId,
        jobId: job.jobId,
        workflowType: job.workflowType,
      })
      await this.completeAttempt({
        workflowAttemptId: attempt.id,
        status: isCountedCancellation
          ? WorkflowAttemptStatusEnum.CANCELLED
          : WorkflowAttemptStatusEnum.FAILED,
        jobCounters,
        attemptCounters,
        completionOwnerClaimedBy: attempt.claimedBy ?? '',
        error: errorFacts,
        errorDiagnostic: { error, source: 'workflow-execute-catch' },
      })
      this.logger.error({
        message: 'workflow_attempt_failed',
        jobId: job.jobId,
        attemptId: attempt.attemptId,
        workflowType: job.workflowType,
        error: errorObject,
      })
    } finally {
      await leaseKeeper.stop()
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
          claimExpiresAt: buildWorkflowClaimDeadline(now),
          heartbeatAt: now,
          startedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(this.workflowAttempt.id, attempt.id),
            eq(this.workflowAttempt.status, WorkflowAttemptStatusEnum.PENDING),
            or(
              isNull(this.workflowAttempt.notBeforeAt),
              lte(this.workflowAttempt.notBeforeAt, now),
            ),
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
          eventCode: 'WORKFLOW_ATTEMPT_CLAIMED',
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
          progressDetail: null,
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
          eventCode: 'WORKFLOW_DRAFT_EXPIRED',
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
    notBeforeAt: Date | null = null,
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
        notBeforeAt,
        selectedItemCount,
        successItemCount: 0,
        failedItemCount: 0,
        skippedItemCount: 0,
        claimedBy: null,
        claimExpiresAt: null,
        heartbeatAt: null,
        ...toWorkflowErrorColumns(null),
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    return attempt
  }

  // 构造通知轮询游标条件；有同秒 ID 游标时使用行值比较贴合 createdAt/id 复合索引。
  private buildNotificationCursorCondition(
    input: WorkflowNotificationListRequestDto,
  ) {
    if (input.afterId === undefined) {
      return gt(this.workflowEvent.createdAt, input.createdAfter!)
    }
    return sql`(${this.workflowEvent.createdAt}, ${this.workflowEvent.id}) > (${input.createdAfter!}, ${BigInt(input.afterId)})`
  }

  private buildNotificationProjectionCondition(
    kinds: Set<WorkflowNotificationKindEnum>,
  ) {
    const conditions: SQL[] = []
    if (kinds.has(WorkflowNotificationKindEnum.SUCCESS)) {
      conditions.push(
        and(
          eq(this.workflowEvent.eventType, WorkflowEventTypeEnum.ATTEMPT_COMPLETED),
          eq(this.workflowEvent.workflowAttemptId, this.workflowJob.currentAttemptFk),
          eq(this.workflowJob.status, WorkflowJobStatusEnum.SUCCESS),
        )!,
      )
    }
    if (kinds.has(WorkflowNotificationKindEnum.FAILED)) {
      conditions.push(
        and(
          eq(this.workflowEvent.eventType, WorkflowEventTypeEnum.ATTEMPT_COMPLETED),
          eq(this.workflowEvent.workflowAttemptId, this.workflowJob.currentAttemptFk),
          inArray(this.workflowJob.status, [
            WorkflowJobStatusEnum.PARTIAL_FAILED,
            WorkflowJobStatusEnum.FAILED,
          ]),
        )!,
      )
    }
    if (kinds.has(WorkflowNotificationKindEnum.RETRYING)) {
      conditions.push(
        and(
          eq(this.workflowEvent.eventType, WorkflowEventTypeEnum.RETRY_REQUESTED),
          eq(
            this.workflowAttempt.triggerType,
            WorkflowAttemptTriggerTypeEnum.SYSTEM_RECOVERY,
          ),
        )!,
      )
    }
    return conditions.length > 0 ? or(...conditions) : undefined
  }

  private toWorkflowNotificationItem(
    row: WorkflowNotificationRow,
  ): WorkflowNotificationItemDto | null {
    if (row.job.archivedAt) {
      return null
    }
    const kind = resolveWorkflowNotificationKind(row)
    if (!kind) {
      return null
    }

    return {
      id: Number(row.event.id),
      kind,
      jobId: row.job.jobId,
      workflowType: row.job.workflowType,
      displayName: row.job.displayName,
      status: normalizeWorkflowJobStatus(row.job.status),
      selectedItemCount: row.job.selectedItemCount,
      successItemCount: row.job.successItemCount,
      failedItemCount: row.job.failedItemCount,
      skippedItemCount: row.job.skippedItemCount,
      createdAt: row.event.createdAt,
      updatedAt: row.job.updatedAt,
      nextRetryAt:
        kind === WorkflowNotificationKindEnum.RETRYING
          ? row.attempt.notBeforeAt
          : null,
    }
  }

  // 启动当前 attempt 的运行时自动续租器。
  private startAttemptLeaseKeeper(
    job: WorkflowJobSelect,
    attempt: WorkflowAttemptSelect,
  ) {
    let stopped = false
    let failure: unknown = null
    let inFlight: Promise<void> | null = null
    const intervalMs = Math.max(1000, WORKFLOW_LEASE_RENEW_INTERVAL_SECONDS * 1000)

    const runRenewal = () => {
      if (stopped || inFlight) {
        return
      }
      inFlight = this.renewLeaseForAttempt(job, attempt)
        .catch((error) => {
          failure ??= error
          if (isWorkflowClaimLostError(error)) {
            this.logWorkflowLeaseLost(job, attempt, error)
            return
          }
          this.logger.warn({
            message: 'workflow_attempt_lease_renew_failed',
            jobId: job.jobId,
            attemptId: attempt.attemptId,
            workflowType: job.workflowType,
            error: toWorkflowErrorObject(error),
          })
        })
        .finally(() => {
          inFlight = null
        })
    }

    const timer = setInterval(runRenewal, intervalMs)

    return {
      assertHealthy: () => {
        if (failure) {
          throw failure
        }
      },
      stop: async () => {
        stopped = true
        clearInterval(timer)
        await inFlight
      },
    }
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

  // 批量读取 attempt，用于记录分页补齐 attempt 关联。
  private async readAttemptsByInternalIds(ids: bigint[]) {
    if (ids.length === 0) {
      return new Map<bigint, WorkflowAttemptSelect>()
    }
    const rows = await this.db
      .select()
      .from(this.workflowAttempt)
      .where(inArray(this.workflowAttempt.id, ids))
    return new Map(rows.map((row) => [row.id, row]))
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
    for (const conflictKey of normalizeWorkflowConflictKeys(conflictKeys)) {
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
        eventCode: input.eventCode,
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
          throw new WorkflowCancellationSignal()
        }
      },
      assertStillOwned: async () => this.assertAttemptStillOwned(job, attempt),
      completeAttempt: async (input: CompleteCurrentWorkflowAttemptInput) => {
        await this.completeAttemptByAttemptId({
          ...input,
          attemptId: attempt.attemptId,
          completionOwnerClaimedBy: attempt.claimedBy ?? '',
        })
      },
      completeAttemptWithDelayedRetry: async (
        input: CompleteCurrentWorkflowAttemptWithDelayedRetryInput,
      ) => {
        await this.completeAttemptWithDelayedRetryByAttemptId({
          ...input,
          attemptId: attempt.attemptId,
          completionOwnerClaimedBy: attempt.claimedBy ?? '',
        })
      },
      updateProgress: async (progress: WorkflowProgress) =>
        this.updateProgressForAttempt(job, attempt, progress),
      appendEvent: async (
        eventType: WorkflowEventTypeEnum,
        eventCode: string,
        detail?: WorkflowObject,
      ) =>
        this.appendEvent({
          workflowJobId: job.id,
          workflowAttemptId: attempt.id,
          eventType,
          eventCode,
          detail: detail ?? null,
        }),
    }
  }

  // 为当前 attempt 续租。
  private async renewLeaseForAttempt(
    job: WorkflowJobSelect,
    attempt: WorkflowAttemptSelect,
  ) {
    const now = new Date()
    const [updatedAttempt] = await this.db
      .update(this.workflowAttempt)
      .set({
        heartbeatAt: now,
        claimExpiresAt: buildWorkflowClaimDeadline(now),
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
  }

  // 更新进度，不承担 attempt claim 续租职责。
  private async updateProgressForAttempt(
    job: WorkflowJobSelect,
    attempt: WorkflowAttemptSelect,
    progress: WorkflowProgress,
  ) {
    if (!(await this.tryAssertAttemptStillOwned(job, attempt))) {
      return
    }

    const now = new Date()
    const update = {
      updatedAt: now,
      ...(progress.code === undefined
        ? {}
        : { progressCode: progress.code }),
      ...(progress.context === undefined
        ? {}
        : { progressContext: progress.context }),
      ...(progress.detail === undefined
        ? {}
        : { progressDetail: progress.detail }),
      ...(progress.percent === undefined
        ? {}
        : { progressPercent: normalizeWorkflowProgressPercent(progress.percent) }),
      ...(progress.counters === undefined
        ? {}
        : {
            successItemCount: progress.counters.successItemCount,
            failedItemCount: progress.counters.failedItemCount,
            skippedItemCount: progress.counters.skippedItemCount,
          }),
    }
    await this.db
      .update(this.workflowJob)
      .set(update)
      .where(
        and(
          eq(this.workflowJob.id, job.id),
          eq(this.workflowJob.status, WorkflowJobStatusEnum.RUNNING),
          eq(this.workflowJob.currentAttemptFk, attempt.id),
          isNull(this.workflowJob.cancelRequestedAt),
        ),
      )
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

  // ownership gate 的 no-op 包装，用于显式 completion 路径阻断陈旧 worker。
  private async tryAssertAttemptStillOwned(
    job: WorkflowJobSelect,
    attempt: WorkflowAttemptSelect,
  ) {
    try {
      await this.assertAttemptStillOwned(job, attempt)
      return true
    } catch (error) {
      if (isWorkflowClaimLostError(error)) {
        this.logWorkflowLeaseLost(job, attempt, error)
        return false
      }
      throw error
    }
  }

  // 构建最终 completion 写入条件；context-bound completion 必须在 UPDATE 内再次证明 ownership。
  private buildAttemptCompletionWhere(
    attempt: WorkflowAttemptSelect,
    input: Pick<CompleteWorkflowAttemptInput, 'completionOwnerClaimedBy'>,
    now: Date,
  ) {
    const conditions = [eq(this.workflowAttempt.id, attempt.id)]
    if (input.completionOwnerClaimedBy !== undefined) {
      conditions.push(
        eq(this.workflowAttempt.status, WorkflowAttemptStatusEnum.RUNNING),
        eq(this.workflowAttempt.claimedBy, input.completionOwnerClaimedBy),
        gt(this.workflowAttempt.claimExpiresAt, now),
      )
    }
    return and(...conditions)
  }

  private isLeaseKeeperHealthy(leaseKeeper: { assertHealthy: () => void }) {
    try {
      leaseKeeper.assertHealthy()
      return true
    } catch (error) {
      if (isWorkflowClaimLostError(error)) {
        return false
      }
      throw error
    }
  }

  private logWorkflowLeaseLost(
    job: WorkflowJobSelect,
    attempt: WorkflowAttemptSelect,
    error: unknown,
  ) {
    this.logger.warn({
      message: 'workflow_attempt_lease_lost',
      jobId: job.jobId,
      attemptId: attempt.attemptId,
      workflowType: job.workflowType,
      error: toWorkflowErrorObject(error),
    })
  }

  // 构建 worker 标识。
  private buildWorkerId() {
    return `workflow-worker-${process.pid}`
  }
}
