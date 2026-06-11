import type { SQL } from 'drizzle-orm'
import type {
  TaskEventFailureClaimResult,
  TaskEventFailureRecordInput,
  TaskEventFailureReplayPayload,
} from './types/task-event-failure.type'
import { randomUUID } from 'node:crypto'
import { DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, desc, eq, isNull, lt, or, sql } from 'drizzle-orm'
import {
  BaseTaskEventFailureDto,
  QueryTaskEventFailurePageDto,
  TaskEventFailureRetryFailureDto,
} from './dto/task-event-failure.dto'
import { TaskEventTemplateRegistry } from './task-event-template.registry'
import { TaskExecutionService } from './task-execution.service'
import {
  TASK_EVENT_FAILURE_MAX_RETRY_COUNT,
  TaskEventFailureStatusEnum,
} from './task.constant'
import { TaskServiceSupport } from './task.service.support'

const TASK_EVENT_FAILURE_CLAIM_LEASE_MS = 10 * 60 * 1000

/**
 * 任务事件消费失败事实服务。
 *
 * 负责失败事实幂等写入、管理端查询和复用 task execution path 的补偿重试。
 */
@Injectable()
export class TaskEventFailureService extends TaskServiceSupport {
  constructor(
    drizzle: DrizzleService,
    private readonly taskExecutionService: TaskExecutionService,
    private readonly taskEventTemplateRegistry: TaskEventTemplateRegistry,
  ) {
    super(drizzle)
  }

  // 幂等记录 task consumer 失败事实。
  async recordTaskEventFailure(input: TaskEventFailureRecordInput) {
    const eventEnvelope = input.payload.eventEnvelope
    const idempotencyKey = this.buildFailureIdempotencyKey(
      eventEnvelope.key,
      input.payload.bizKey,
    )
    const template = this.taskEventTemplateRegistry.getTemplateByEventCode(
      eventEnvelope.code,
    )
    const occurredAt = eventEnvelope.occurredAt ?? new Date()
    const keepActiveClaim = sql`
      ${this.taskEventFailureTable.status} = ${TaskEventFailureStatusEnum.RETRYING}
      AND ${this.taskEventFailureTable.processingExpiredAt} > now()
    `

    await this.db
      .insert(this.taskEventFailureTable)
      .values({
        idempotencyKey,
        eventKey: eventEnvelope.key,
        eventBizKey: input.payload.bizKey,
        eventCode: eventEnvelope.code,
        templateKey: template?.templateKey ?? null,
        userId: eventEnvelope.subjectId,
        targetType: String(eventEnvelope.targetType),
        targetId: eventEnvelope.targetId,
        status: TaskEventFailureStatusEnum.PENDING,
        retryCount: 0,
        lastErrorMessage: this.truncateMessage(input.errorMessage, 1000),
        requestPayload: this.serializeReplayPayload(input.payload),
        occurredAt,
      })
      .onConflictDoUpdate({
        target: this.taskEventFailureTable.idempotencyKey,
        set: {
          status: sql`
            CASE
              WHEN ${keepActiveClaim}
                THEN ${this.taskEventFailureTable.status}
              ELSE ${TaskEventFailureStatusEnum.PENDING}
            END
          `,
          retryCount: sql`
            CASE
              WHEN ${this.taskEventFailureTable.status} IN (
                ${TaskEventFailureStatusEnum.RESOLVED},
                ${TaskEventFailureStatusEnum.TERMINAL}
              )
                THEN 0
              ELSE ${this.taskEventFailureTable.retryCount}
            END
          `,
          lastErrorMessage: this.truncateMessage(input.errorMessage, 1000),
          terminalErrorAt: sql`
            CASE WHEN ${keepActiveClaim}
              THEN ${this.taskEventFailureTable.terminalErrorAt}
              ELSE NULL
            END
          `,
          terminalReason: sql`
            CASE WHEN ${keepActiveClaim}
              THEN ${this.taskEventFailureTable.terminalReason}
              ELSE NULL
            END
          `,
          processingToken: sql`
            CASE WHEN ${keepActiveClaim}
              THEN ${this.taskEventFailureTable.processingToken}
              ELSE NULL
            END
          `,
          processingStartedAt: sql`
            CASE WHEN ${keepActiveClaim}
              THEN ${this.taskEventFailureTable.processingStartedAt}
              ELSE NULL
            END
          `,
          processingExpiredAt: sql`
            CASE WHEN ${keepActiveClaim}
              THEN ${this.taskEventFailureTable.processingExpiredAt}
              ELSE NULL
            END
          `,
          requestPayload: this.serializeReplayPayload(input.payload),
          occurredAt,
        },
      })
  }

  // 分页查询 task consumer 失败事实。
  async getTaskEventFailurePage(params: QueryTaskEventFailurePageDto = {}) {
    const page = this.drizzle.buildPage(params)
    const conditions: SQL[] = [isNull(this.taskEventFailureTable.deletedAt)]

    if (params.status !== undefined) {
      conditions.push(eq(this.taskEventFailureTable.status, params.status))
    }
    if (params.eventKey) {
      conditions.push(eq(this.taskEventFailureTable.eventKey, params.eventKey))
    }
    if (params.eventBizKey) {
      conditions.push(
        eq(this.taskEventFailureTable.eventBizKey, params.eventBizKey),
      )
    }
    if (params.eventCode !== undefined) {
      conditions.push(eq(this.taskEventFailureTable.eventCode, params.eventCode))
    }
    if (params.userId !== undefined) {
      conditions.push(eq(this.taskEventFailureTable.userId, params.userId))
    }

    const where = and(...conditions)
    const [list, totalRows] = await Promise.all([
      this.db
        .select()
        .from(this.taskEventFailureTable)
        .where(where)
        .orderBy(
          desc(this.taskEventFailureTable.createdAt),
          desc(this.taskEventFailureTable.id),
        )
        .limit(page.limit)
        .offset(page.offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(this.taskEventFailureTable)
        .where(where),
    ])

    return {
      list: list.map((item) => this.toTaskEventFailurePageItem(item)),
      total: Number(totalRows[0]?.count ?? 0),
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
    }
  }

  // 重试单条 task consumer 失败事实。
  async retryTaskEventFailure(id: number) {
    const claim = await this.claimTaskEventFailure(id)

    try {
      const replayPayload = this.parseReplayPayload(claim.failure.requestPayload)
      await this.taskExecutionService.consumeEventProgress({
        eventEnvelope: replayPayload.eventEnvelope,
        bizKey: replayPayload.bizKey,
      })
      const retryCount = await this.markTaskEventFailureResolved(claim)

      return {
        failureId: claim.failure.id,
        status: TaskEventFailureStatusEnum.RESOLVED,
        retryCount,
        message: '任务事件消费重试成功',
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const status = await this.markTaskEventFailureRetryFailed(claim, message)

      return {
        failureId: claim.failure.id,
        status,
        retryCount: claim.failure.retryCount + 1,
        message,
      }
    }
  }

  // 批量重试待处理的 task consumer 失败事实。
  async retryPendingTaskEventFailuresBatch(limit = 100) {
    const normalizedLimit = Math.min(Math.max(Math.trunc(limit), 1), 500)
    const rows = await this.db
      .select({ id: this.taskEventFailureTable.id })
      .from(this.taskEventFailureTable)
      .where(
        and(
          isNull(this.taskEventFailureTable.deletedAt),
          eq(
            this.taskEventFailureTable.status,
            TaskEventFailureStatusEnum.PENDING,
          ),
          lt(
            this.taskEventFailureTable.retryCount,
            TASK_EVENT_FAILURE_MAX_RETRY_COUNT,
          ),
        ),
      )
      .orderBy(
        desc(this.taskEventFailureTable.createdAt),
        desc(this.taskEventFailureTable.id),
      )
      .limit(normalizedLimit)

    let succeededCount = 0
    let failedCount = 0
    let skippedCount = 0
    const failures: TaskEventFailureRetryFailureDto[] = []

    for (const row of rows) {
      let result: Awaited<ReturnType<typeof this.retryTaskEventFailure>>
      try {
        result = await this.retryTaskEventFailure(row.id)
      } catch (error) {
        skippedCount += 1
        this.pushFailureSummary(failures, {
          failureId: row.id,
          message: error instanceof Error ? error.message : String(error),
        })
        continue
      }
      if (result.status === TaskEventFailureStatusEnum.RESOLVED) {
        succeededCount += 1
      } else if (result.status === TaskEventFailureStatusEnum.TERMINAL) {
        failedCount += 1
        this.pushFailureSummary(failures, {
          failureId: row.id,
          message: result.message,
        })
      } else {
        failedCount += 1
        this.pushFailureSummary(failures, {
          failureId: row.id,
          message: result.message,
        })
      }
    }

    return {
      scannedCount: rows.length,
      succeededCount,
      failedCount,
      skippedCount,
      failures,
    }
  }

  private async claimTaskEventFailure(
    id: number,
  ): Promise<TaskEventFailureClaimResult> {
    const token = randomUUID()
    const now = new Date()
    const expiredAt = new Date(now.getTime() + TASK_EVENT_FAILURE_CLAIM_LEASE_MS)

    const [failure] = await this.db
      .update(this.taskEventFailureTable)
      .set({
        status: TaskEventFailureStatusEnum.RETRYING,
        processingToken: token,
        processingStartedAt: now,
        processingExpiredAt: expiredAt,
        lastRetryAt: now,
      })
      .where(
        and(
          eq(this.taskEventFailureTable.id, id),
          isNull(this.taskEventFailureTable.deletedAt),
          lt(
            this.taskEventFailureTable.retryCount,
            TASK_EVENT_FAILURE_MAX_RETRY_COUNT,
          ),
          or(
            eq(
              this.taskEventFailureTable.status,
              TaskEventFailureStatusEnum.PENDING,
            ),
            and(
              eq(
                this.taskEventFailureTable.status,
                TaskEventFailureStatusEnum.RETRYING,
              ),
              lt(this.taskEventFailureTable.processingExpiredAt, now),
            ),
          ),
        ),
      )
      .returning()

    if (!failure || failure.processingToken !== token) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '失败事实已解决、终态、超过重试上限或正在被处理',
      )
    }

    return { failure, token }
  }

  private async markTaskEventFailureResolved(
    claim: TaskEventFailureClaimResult,
  ) {
    const retryCount = claim.failure.retryCount + 1
    await this.db
      .update(this.taskEventFailureTable)
      .set({
        status: TaskEventFailureStatusEnum.RESOLVED,
        retryCount,
        resolvedAt: new Date(),
        lastErrorMessage: null,
        processingToken: null,
        processingStartedAt: null,
        processingExpiredAt: null,
      })
      .where(
        and(
          eq(this.taskEventFailureTable.id, claim.failure.id),
          eq(this.taskEventFailureTable.processingToken, claim.token),
        ),
      )

    return retryCount
  }

  private async markTaskEventFailureRetryFailed(
    claim: TaskEventFailureClaimResult,
    message: string,
  ) {
    const retryCount = claim.failure.retryCount + 1
    const terminal = retryCount >= TASK_EVENT_FAILURE_MAX_RETRY_COUNT
    const status = terminal
      ? TaskEventFailureStatusEnum.TERMINAL
      : TaskEventFailureStatusEnum.PENDING

    await this.db
      .update(this.taskEventFailureTable)
      .set({
        status,
        retryCount,
        lastErrorMessage: this.truncateMessage(message, 1000),
        terminalErrorAt: terminal ? new Date() : null,
        terminalReason: terminal
          ? this.truncateMessage('超过最大重试次数', 500)
          : null,
        processingToken: null,
        processingStartedAt: null,
        processingExpiredAt: null,
      })
      .where(
        and(
          eq(this.taskEventFailureTable.id, claim.failure.id),
          eq(this.taskEventFailureTable.processingToken, claim.token),
        ),
      )

    return status
  }

  private toTaskEventFailurePageItem(
    failure: typeof this.taskEventFailureTable.$inferSelect,
  ): BaseTaskEventFailureDto {
    return {
      id: failure.id,
      createdAt: failure.createdAt,
      updatedAt: failure.updatedAt,
      idempotencyKey: failure.idempotencyKey,
      eventKey: failure.eventKey,
      eventBizKey: failure.eventBizKey,
      eventCode: failure.eventCode,
      templateKey: failure.templateKey ?? null,
      userId: failure.userId,
      targetType: failure.targetType ?? null,
      targetId: failure.targetId ?? null,
      status: failure.status,
      retryCount: failure.retryCount,
      lastRetryAt: failure.lastRetryAt ?? null,
      lastErrorMessage: failure.lastErrorMessage ?? null,
      resolvedAt: failure.resolvedAt ?? null,
      terminalErrorAt: failure.terminalErrorAt ?? null,
      terminalReason: failure.terminalReason ?? null,
      occurredAt: failure.occurredAt,
      requestPayload:
        failure.requestPayload &&
        typeof failure.requestPayload === 'object' &&
        !Array.isArray(failure.requestPayload)
          ? (failure.requestPayload as Record<string, unknown>)
          : {},
    }
  }

  private serializeReplayPayload(
    payload: TaskEventFailureRecordInput['payload'],
  ): TaskEventFailureReplayPayload {
    return {
      ...payload,
      eventEnvelope: {
        ...payload.eventEnvelope,
        occurredAt: payload.eventEnvelope.occurredAt,
      },
    }
  }

  private parseReplayPayload(payload: unknown): TaskEventFailureReplayPayload {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '失败事实缺少必要重放上下文',
      )
    }

    const replayPayload = payload as TaskEventFailureReplayPayload
    const occurredAt = replayPayload.eventEnvelope?.occurredAt
    if (!replayPayload.eventEnvelope || !replayPayload.bizKey) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '失败事实缺少必要重放上下文',
      )
    }

    replayPayload.eventEnvelope.occurredAt =
      occurredAt instanceof Date ? occurredAt : new Date(String(occurredAt))

    return replayPayload
  }

  private buildFailureIdempotencyKey(eventKey: string, bizKey: string) {
    return `task:event:${eventKey}:${bizKey}`
  }

  private truncateMessage(message: string, maxLength: number) {
    return message.length > maxLength ? message.slice(0, maxLength) : message
  }

  private pushFailureSummary(
    failures: TaskEventFailureRetryFailureDto[],
    failure: TaskEventFailureRetryFailureDto,
  ) {
    if (failures.length < 20) {
      failures.push(failure)
    }
  }
}
