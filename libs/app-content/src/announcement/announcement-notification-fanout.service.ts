import type { Db, DbExecutor } from '@db/core'
import type { AppAnnouncementNotificationFanoutTaskSelect } from '@db/schema'
import type {
  AnnouncementDecisionSnapshot,
  AnnouncementFanoutConsumeBudget,
  AnnouncementFanoutConsumeOptions,
  AnnouncementFanoutEventKey,
} from './announcement.type'
import { DrizzleService } from '@db/core'
import { DomainEventPublisher } from '@libs/eventing/eventing/domain-event-publisher.service'
import { DomainEventConsumerEnum } from '@libs/eventing/eventing/eventing.constant'
import { BusinessErrorCode, EnablePlatformEnum } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { BadRequestException, Injectable } from '@nestjs/common'
import {
  and,
  arrayOverlaps,
  asc,
  desc,
  eq,
  gt,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
} from 'drizzle-orm'
import {
  isAnnouncementPublishedNow,
  shouldAnnouncementEnterNotificationCenter,
} from './announcement.constant'

const ANNOUNCEMENT_FANOUT_BATCH_SIZE = 200
const ANNOUNCEMENT_FANOUT_CLAIM_LEASE_MS = 10 * 60 * 1000
const ANNOUNCEMENT_FANOUT_CONSUME_MAX_TASKS = 10
const ANNOUNCEMENT_FANOUT_CONSUME_MAX_MS = 4 * 1000
const ANNOUNCEMENT_FANOUT_MAX_ATTEMPTS = 5
const ANNOUNCEMENT_FANOUT_RETRY_BASE_MS = 60 * 1000
const ANNOUNCEMENT_FANOUT_TASK_MAX_BATCHES = 10
const ANNOUNCEMENT_LIFECYCLE_ENQUEUE_BATCH_SIZE = 200

export const ANNOUNCEMENT_FANOUT_PENDING_STATUS = 0
export const ANNOUNCEMENT_FANOUT_PROCESSING_STATUS = 1
export const ANNOUNCEMENT_FANOUT_SUCCESS_STATUS = 2
export const ANNOUNCEMENT_FANOUT_FAILED_STATUS = 3

@Injectable()
export class AnnouncementNotificationFanoutService {
  private isConsumingPendingTasks = false

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly domainEventPublisher: DomainEventPublisher,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get appAnnouncement() {
    return this.drizzle.schema.appAnnouncement
  }

  private get appUser() {
    return this.drizzle.schema.appUser
  }

  private get userNotification() {
    return this.drizzle.schema.userNotification
  }

  private get fanoutTask() {
    return this.drizzle.schema.appAnnouncementNotificationFanoutTask
  }

  // 在公告写事务内复用同一 fanout 入队逻辑，避免内容状态与任务状态分裂。
  async enqueueAnnouncementFanout(
    announcementId: number,
    tx: DbExecutor = this.db,
  ) {
    const announcement = await this.loadAnnouncementDecisionSnapshot(
      announcementId,
      tx,
    )
    if (!announcement) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '公告不存在',
      )
    }

    const desiredEventKey = this.resolveAnnouncementEventKey(announcement)
    const boundaryKey = this.buildManualBoundaryKey(announcement)
    await this.insertFanoutTask(
      {
        announcementId,
        desiredEventKey,
        eventBoundaryKey: boundaryKey,
      },
      tx,
    )
    return true
  }

  async enqueueDueLifecycleFanoutTasks(now = new Date()) {
    const [activeAnnouncements, expiredAnnouncements] = await Promise.all([
      this.loadLifecycleActiveAnnouncements(now),
      this.loadLifecycleExpiredAnnouncements(now),
    ])

    let enqueuedCount = 0
    for (const announcement of activeAnnouncements) {
      if (!announcement.publishStartTime) {
        continue
      }
      await this.enqueueLifecycleStartFanoutTask({
        id: announcement.id,
        publishStartTime: announcement.publishStartTime,
      })
      enqueuedCount += 1
    }

    for (const announcement of expiredAnnouncements) {
      if (!announcement.publishEndTime) {
        continue
      }
      await this.enqueueLifecycleEndFanoutTask({
        id: announcement.id,
        publishEndTime: announcement.publishEndTime,
      })
      enqueuedCount += 1
    }

    return enqueuedCount
  }

  async retryFailedAnnouncementFanout(
    announcementId: number,
    tx: DbExecutor = this.db,
  ) {
    const latestRows = await tx
      .select({
        id: this.fanoutTask.id,
        status: this.fanoutTask.status,
      })
      .from(this.fanoutTask)
      .where(eq(this.fanoutTask.announcementId, announcementId))
      .orderBy(desc(this.fanoutTask.updatedAt), desc(this.fanoutTask.id))
      .limit(1)

    const latestTask = latestRows[0]
    if (
      !latestTask ||
      latestTask.status !== ANNOUNCEMENT_FANOUT_FAILED_STATUS
    ) {
      throw new BadRequestException('当前公告没有失败的消息中心通知任务')
    }

    const result = await tx
      .update(this.fanoutTask)
      .set({
        status: ANNOUNCEMENT_FANOUT_PENDING_STATUS,
        attemptCount: 0,
        cursorUserId: null,
        lastError: null,
        nextAttemptAt: null,
        processingLeaseExpiresAt: null,
        startedAt: null,
        finishedAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(this.fanoutTask.id, latestTask.id),
          eq(this.fanoutTask.status, ANNOUNCEMENT_FANOUT_FAILED_STATUS),
        ),
      )
      .returning()

    this.drizzle.assertAffectedRows(
      result,
      '消息中心通知任务已变化，请刷新后重试',
    )
    if (result[0]) {
      await this.syncCurrentAnnouncementFanoutRuntime(result[0], tx)
    }
    return true
  }

  async consumePendingTasks(options: AnnouncementFanoutConsumeOptions = {}) {
    if (this.isConsumingPendingTasks) {
      return 0
    }

    this.isConsumingPendingTasks = true
    try {
      const maxTasks = options.maxTasks ?? ANNOUNCEMENT_FANOUT_CONSUME_MAX_TASKS
      const budget = this.createConsumeBudget(options)
      let consumedCount = 0

      while (consumedCount < maxTasks && this.hasConsumeTimeBudget(budget)) {
        const task = await this.claimNextRunnableTask()
        if (!task) {
          return consumedCount
        }

        consumedCount += 1
        await this.processTask(task, budget)
      }

      return consumedCount
    } finally {
      this.isConsumingPendingTasks = false
    }
  }

  private async insertFanoutTask(
    input: {
      announcementId: number
      desiredEventKey: AnnouncementFanoutEventKey
      eventBoundaryKey: string
    },
    tx: DbExecutor = this.db,
  ) {
    const now = new Date()
    const fanoutKey = this.buildFanoutKey(input)
    const insertedRows = await this.drizzle.withErrorHandling(() =>
      tx
        .insert(this.fanoutTask)
        .values({
          announcementId: input.announcementId,
          desiredEventKey: input.desiredEventKey,
          eventBoundaryKey: input.eventBoundaryKey,
          fanoutKey,
          status: ANNOUNCEMENT_FANOUT_PENDING_STATUS,
          attemptCount: 0,
          cursorUserId: null,
          lastError: null,
          startedAt: null,
          processingLeaseExpiresAt: null,
          nextAttemptAt: null,
          finishedAt: null,
          updatedAt: now,
        })
        .onConflictDoNothing({
          target: this.fanoutTask.fanoutKey,
        })
        .returning(),
    )
    if (insertedRows[0]) {
      await this.promoteAnnouncementFanoutRuntime(insertedRows[0], tx)
    }
  }

  private async enqueueLifecycleStartFanoutTask(announcement: {
    id: number
    publishStartTime: Date
  }) {
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await this.insertFanoutTask(
          {
            announcementId: announcement.id,
            desiredEventKey: 'announcement.published',
            eventBoundaryKey: this.buildStartBoundaryKey(
              announcement.publishStartTime,
            ),
          },
          tx,
        )
        await this.markLifecycleStartBoundaryEnqueued(announcement, tx)
      },
    })
  }

  private async enqueueLifecycleEndFanoutTask(announcement: {
    id: number
    publishEndTime: Date
  }) {
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await this.insertFanoutTask(
          {
            announcementId: announcement.id,
            desiredEventKey: 'announcement.unpublished',
            eventBoundaryKey: this.buildEndBoundaryKey(
              announcement.publishEndTime,
            ),
          },
          tx,
        )
        await this.markLifecycleEndBoundaryEnqueued(announcement, tx)
      },
    })
  }

  private async processTask(
    task: AppAnnouncementNotificationFanoutTaskSelect,
    budget = this.createConsumeBudget({
      maxBatchesPerTask: Number.POSITIVE_INFINITY,
      maxRuntimeMs: Number.POSITIVE_INFINITY,
    }),
  ) {
    let leaseExpiresAt = task.processingLeaseExpiresAt
    if (!leaseExpiresAt) {
      await this.markTaskFailed(
        task,
        null,
        'fanout_task_missing_processing_lease',
      )
      return
    }

    const eventKey = task.desiredEventKey as AnnouncementFanoutEventKey
    const decision = await this.loadAnnouncementDecisionSnapshot(
      task.announcementId,
    )
    if (!decision && eventKey === 'announcement.published') {
      await this.markTaskFailed(
        task,
        task.cursorUserId,
        'announcement_not_found',
      )
      return
    }
    if (decision && this.resolveAnnouncementEventKey(decision) !== eventKey) {
      await this.markTaskSucceeded(task, leaseExpiresAt)
      return
    }
    if (decision && this.isObsoleteFanoutBoundary(task, decision)) {
      await this.markTaskSucceeded(task, leaseExpiresAt)
      return
    }

    const announcement = await this.loadAnnouncementPayloadSnapshot(
      task.announcementId,
    )
    if (eventKey === 'announcement.published' && !announcement) {
      await this.markTaskFailed(
        task,
        task.cursorUserId,
        'announcement_not_found',
      )
      return
    }

    let cursorUserId = task.cursorUserId ?? undefined
    let processedBatchCount = 0

    while (true) {
      const receiverUserIds =
        eventKey === 'announcement.published'
          ? await this.loadPublishedReceiverUserIds(cursorUserId)
          : await this.loadUnpublishedReceiverUserIds(
              task.announcementId,
              cursorUserId,
            )

      if (receiverUserIds.length === 0) {
        await this.markTaskSucceeded(task, leaseExpiresAt)
        return
      }

      let lastProcessedUserId = cursorUserId ?? null

      try {
        await this.domainEventPublisher.publishManyByIdempotencyKey(
          receiverUserIds.map((receiverUserId) => {
            const context = this.buildAnnouncementNotificationContext({
              announcementId: task.announcementId,
              receiverUserId,
              eventKey,
              title: announcement?.title,
              content: announcement
                ? this.buildAnnouncementNotificationContent(
                    announcement.summary,
                    announcement.content,
                  )
                : undefined,
              announcementType: announcement?.announcementType,
              priorityLevel: announcement?.priorityLevel,
            })

            return {
              eventKey,
              domain: 'app-content',
              idempotencyKey: context.projectionKey,
              subjectType: 'system',
              subjectId: task.announcementId,
              targetType: 'announcement',
              targetId: task.announcementId,
              consumers: [DomainEventConsumerEnum.NOTIFICATION],
              context,
            }
          }),
        )
        lastProcessedUserId = receiverUserIds.at(-1) ?? lastProcessedUserId
        processedBatchCount += 1
      } catch (error) {
        await this.markTaskFailed(
          task,
          lastProcessedUserId,
          this.stringifyError(error),
          leaseExpiresAt,
        )
        return
      }

      const nextCursorUserId = receiverUserIds.at(-1) ?? lastProcessedUserId
      if (
        processedBatchCount >= budget.maxBatchesPerTask ||
        !this.hasConsumeTimeBudget(budget)
      ) {
        await this.pauseTaskForNextTick(
          task,
          leaseExpiresAt,
          nextCursorUserId ?? null,
        )
        return
      }

      const nextLeaseExpiresAt = await this.advanceTaskCursor(
        task,
        leaseExpiresAt,
        nextCursorUserId ?? null,
      )
      if (!nextLeaseExpiresAt) {
        return
      }
      leaseExpiresAt = nextLeaseExpiresAt
      cursorUserId = nextCursorUserId ?? undefined
    }
  }

  private async claimNextRunnableTask() {
    const now = new Date()
    const runnableWhere = this.buildRunnableTaskWhere(now)
    const rows = await this.db
      .select({
        id: this.fanoutTask.id,
        startedAt: this.fanoutTask.startedAt,
      })
      .from(this.fanoutTask)
      .where(runnableWhere)
      .orderBy(
        asc(this.fanoutTask.status),
        asc(this.fanoutTask.processingLeaseExpiresAt),
        asc(this.fanoutTask.attemptCount),
        asc(this.fanoutTask.updatedAt),
        asc(this.fanoutTask.id),
      )
      .limit(1)

    const pendingTask = rows[0]
    if (!pendingTask) {
      return null
    }

    const leaseExpiresAt = this.buildLeaseExpiresAt(now)
    const claimedRows = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.fanoutTask)
        .set({
          status: ANNOUNCEMENT_FANOUT_PROCESSING_STATUS,
          attemptCount: sql<number>`
            case
              when ${this.fanoutTask.status} = ${ANNOUNCEMENT_FANOUT_PENDING_STATUS}
                and ${this.fanoutTask.cursorUserId} is not null
                and ${this.fanoutTask.lastError} is null
              then ${this.fanoutTask.attemptCount}
              else ${this.fanoutTask.attemptCount} + 1
            end
          `.mapWith(Number),
          startedAt: pendingTask.startedAt ?? now,
          finishedAt: null,
          lastError: null,
          nextAttemptAt: null,
          processingLeaseExpiresAt: leaseExpiresAt,
          updatedAt: now,
        })
        .where(and(eq(this.fanoutTask.id, pendingTask.id), runnableWhere))
        .returning(),
    )

    const claimedTask = claimedRows[0] ?? null
    if (claimedTask) {
      await this.syncCurrentAnnouncementFanoutRuntime(claimedTask)
    }
    return claimedTask
  }

  private buildRunnableTaskWhere(now: Date) {
    return or(
      eq(this.fanoutTask.status, ANNOUNCEMENT_FANOUT_PENDING_STATUS),
      and(
        eq(this.fanoutTask.status, ANNOUNCEMENT_FANOUT_FAILED_STATUS),
        lt(this.fanoutTask.attemptCount, ANNOUNCEMENT_FANOUT_MAX_ATTEMPTS),
        or(
          isNull(this.fanoutTask.nextAttemptAt),
          lte(this.fanoutTask.nextAttemptAt, now),
        ),
      ),
      and(
        eq(this.fanoutTask.status, ANNOUNCEMENT_FANOUT_PROCESSING_STATUS),
        lte(this.fanoutTask.processingLeaseExpiresAt, now),
      ),
    )
  }

  private async advanceTaskCursor(
    task: AppAnnouncementNotificationFanoutTaskSelect,
    leaseExpiresAt: Date,
    cursorUserId: number | null,
  ) {
    const now = new Date()
    const nextLeaseExpiresAt = this.buildLeaseExpiresAt(now)
    const rows = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.fanoutTask)
        .set({
          cursorUserId,
          processingLeaseExpiresAt: nextLeaseExpiresAt,
          updatedAt: now,
        })
        .where(this.buildClaimOwnerWhere(task, leaseExpiresAt))
        .returning({
          processingLeaseExpiresAt: this.fanoutTask.processingLeaseExpiresAt,
        }),
    )

    return rows[0]?.processingLeaseExpiresAt ?? null
  }

  private async pauseTaskForNextTick(
    task: AppAnnouncementNotificationFanoutTaskSelect,
    leaseExpiresAt: Date,
    cursorUserId: number | null,
  ) {
    const now = new Date()
    const rows = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.fanoutTask)
        .set({
          status: ANNOUNCEMENT_FANOUT_PENDING_STATUS,
          cursorUserId,
          processingLeaseExpiresAt: null,
          updatedAt: now,
        })
        .where(this.buildClaimOwnerWhere(task, leaseExpiresAt))
        .returning(),
    )

    if (rows[0]) {
      await this.syncCurrentAnnouncementFanoutRuntime(rows[0])
    }
  }

  private async markTaskSucceeded(
    task: AppAnnouncementNotificationFanoutTaskSelect,
    leaseExpiresAt: Date,
  ) {
    const now = new Date()
    const rows = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.fanoutTask)
        .set({
          status: ANNOUNCEMENT_FANOUT_SUCCESS_STATUS,
          cursorUserId: null,
          lastError: null,
          nextAttemptAt: null,
          processingLeaseExpiresAt: null,
          finishedAt: now,
          updatedAt: now,
        })
        .where(this.buildClaimOwnerWhere(task, leaseExpiresAt))
        .returning(),
    )
    if (rows[0]) {
      await this.syncCurrentAnnouncementFanoutRuntime(rows[0])
    }
  }

  private async markTaskFailed(
    task: AppAnnouncementNotificationFanoutTaskSelect,
    cursorUserId: number | null,
    reason: string,
    leaseExpiresAt = task.processingLeaseExpiresAt,
  ) {
    const now = new Date()
    const rows = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.fanoutTask)
        .set({
          status: ANNOUNCEMENT_FANOUT_FAILED_STATUS,
          cursorUserId,
          lastError: reason.slice(0, 500),
          nextAttemptAt: this.buildNextAttemptAt(task.attemptCount, now),
          processingLeaseExpiresAt: null,
          updatedAt: now,
        })
        .where(
          leaseExpiresAt
            ? this.buildClaimOwnerWhere(task, leaseExpiresAt)
            : eq(this.fanoutTask.id, task.id),
        )
        .returning(),
    )
    if (rows[0]) {
      await this.syncCurrentAnnouncementFanoutRuntime(rows[0])
    }
  }

  private async promoteAnnouncementFanoutRuntime(
    task: AppAnnouncementNotificationFanoutTaskSelect,
    tx: DbExecutor = this.db,
  ) {
    await tx
      .update(this.appAnnouncement)
      .set(this.buildAnnouncementFanoutRuntimeSet(task))
      .where(eq(this.appAnnouncement.id, task.announcementId))
  }

  private async syncCurrentAnnouncementFanoutRuntime(
    task: AppAnnouncementNotificationFanoutTaskSelect,
    tx: DbExecutor = this.db,
  ) {
    await tx
      .update(this.appAnnouncement)
      .set(this.buildAnnouncementFanoutRuntimeSet(task))
      .where(
        and(
          eq(this.appAnnouncement.id, task.announcementId),
          eq(this.appAnnouncement.notificationFanoutTaskId, task.id),
        ),
      )
  }

  private buildAnnouncementFanoutRuntimeSet(
    task: AppAnnouncementNotificationFanoutTaskSelect,
  ) {
    return {
      notificationFanoutDesiredEventKey: task.desiredEventKey,
      notificationFanoutLastError: task.lastError,
      notificationFanoutStatus: task.status,
      notificationFanoutTaskId: task.id,
      notificationFanoutUpdatedAt: task.updatedAt,
      updatedAt: sql`${this.appAnnouncement.updatedAt}`,
    }
  }

  private buildClaimOwnerWhere(
    task: AppAnnouncementNotificationFanoutTaskSelect,
    leaseExpiresAt: Date,
  ) {
    return and(
      eq(this.fanoutTask.id, task.id),
      eq(this.fanoutTask.status, ANNOUNCEMENT_FANOUT_PROCESSING_STATUS),
      eq(this.fanoutTask.desiredEventKey, task.desiredEventKey),
      eq(this.fanoutTask.eventBoundaryKey, task.eventBoundaryKey),
      eq(this.fanoutTask.processingLeaseExpiresAt, leaseExpiresAt),
    )
  }

  private createConsumeBudget(
    options: AnnouncementFanoutConsumeOptions = {},
  ): AnnouncementFanoutConsumeBudget {
    const nowMs = options.nowMs ?? Date.now
    return {
      maxBatchesPerTask:
        options.maxBatchesPerTask ?? ANNOUNCEMENT_FANOUT_TASK_MAX_BATCHES,
      maxRuntimeMs: options.maxRuntimeMs ?? ANNOUNCEMENT_FANOUT_CONSUME_MAX_MS,
      nowMs,
      startedAtMs: nowMs(),
    }
  }

  private hasConsumeTimeBudget(budget: AnnouncementFanoutConsumeBudget) {
    return budget.nowMs() - budget.startedAtMs < budget.maxRuntimeMs
  }

  private async loadPublishedReceiverUserIds(cursorUserId?: number) {
    const conditions = [
      eq(this.appUser.isEnabled, true),
      isNull(this.appUser.deletedAt),
      cursorUserId !== undefined
        ? gt(this.appUser.id, cursorUserId)
        : undefined,
    ].filter(Boolean)

    const rows = await this.db
      .select({
        id: this.appUser.id,
      })
      .from(this.appUser)
      .where(and(...conditions))
      .orderBy(asc(this.appUser.id))
      .limit(ANNOUNCEMENT_FANOUT_BATCH_SIZE)

    return rows.map((row) => row.id)
  }

  private async loadUnpublishedReceiverUserIds(
    announcementId: number,
    cursorUserId?: number,
  ) {
    const conditions = [
      eq(this.userNotification.categoryKey, 'system_announcement'),
      eq(this.userNotification.announcementId, announcementId),
      cursorUserId !== undefined
        ? gt(this.userNotification.receiverUserId, cursorUserId)
        : undefined,
    ].filter(Boolean)

    const rows = await this.db
      .select({
        receiverUserId: this.userNotification.receiverUserId,
      })
      .from(this.userNotification)
      .where(and(...conditions))
      .orderBy(asc(this.userNotification.receiverUserId))
      .limit(ANNOUNCEMENT_FANOUT_BATCH_SIZE)

    return [...new Set(rows.map((row) => row.receiverUserId))]
  }

  private async loadLifecycleActiveAnnouncements(now: Date) {
    return this.db
      .select({
        id: this.appAnnouncement.id,
        publishStartTime: this.appAnnouncement.publishStartTime,
      })
      .from(this.appAnnouncement)
      .where(
        and(
          eq(this.appAnnouncement.isRealtime, true),
          eq(this.appAnnouncement.isPublished, true),
          arrayOverlaps(this.appAnnouncement.enablePlatform, [
            EnablePlatformEnum.APP,
          ]),
          isNotNull(this.appAnnouncement.publishStartTime),
          lte(this.appAnnouncement.publishStartTime, now),
          sql`${this.appAnnouncement.notificationStartBoundaryAt} is distinct from ${this.appAnnouncement.publishStartTime}`,
          or(
            isNull(this.appAnnouncement.publishEndTime),
            gt(this.appAnnouncement.publishEndTime, now),
          ),
        ),
      )
      .orderBy(
        asc(this.appAnnouncement.publishStartTime),
        asc(this.appAnnouncement.id),
      )
      .limit(ANNOUNCEMENT_LIFECYCLE_ENQUEUE_BATCH_SIZE)
  }

  private async loadLifecycleExpiredAnnouncements(now: Date) {
    return this.db
      .select({
        id: this.appAnnouncement.id,
        publishEndTime: this.appAnnouncement.publishEndTime,
      })
      .from(this.appAnnouncement)
      .where(
        and(
          eq(this.appAnnouncement.isRealtime, true),
          eq(this.appAnnouncement.isPublished, true),
          arrayOverlaps(this.appAnnouncement.enablePlatform, [
            EnablePlatformEnum.APP,
          ]),
          isNotNull(this.appAnnouncement.publishEndTime),
          lte(this.appAnnouncement.publishEndTime, now),
          sql`${this.appAnnouncement.notificationEndBoundaryAt} is distinct from ${this.appAnnouncement.publishEndTime}`,
        ),
      )
      .orderBy(
        asc(this.appAnnouncement.publishEndTime),
        asc(this.appAnnouncement.id),
      )
      .limit(ANNOUNCEMENT_LIFECYCLE_ENQUEUE_BATCH_SIZE)
  }

  private async markLifecycleStartBoundaryEnqueued(
    announcement: {
      id: number
      publishStartTime: Date
    },
    tx: DbExecutor,
  ) {
    await tx
      .update(this.appAnnouncement)
      .set({
        notificationStartBoundaryAt: announcement.publishStartTime,
      })
      .where(
        and(
          eq(this.appAnnouncement.id, announcement.id),
          eq(
            this.appAnnouncement.publishStartTime,
            announcement.publishStartTime,
          ),
        ),
      )
  }

  private async markLifecycleEndBoundaryEnqueued(
    announcement: {
      id: number
      publishEndTime: Date
    },
    tx: DbExecutor,
  ) {
    await tx
      .update(this.appAnnouncement)
      .set({
        notificationEndBoundaryAt: announcement.publishEndTime,
      })
      .where(
        and(
          eq(this.appAnnouncement.id, announcement.id),
          eq(this.appAnnouncement.publishEndTime, announcement.publishEndTime),
        ),
      )
  }

  private async loadAnnouncementDecisionSnapshot(
    announcementId: number,
    db: Db = this.db,
  ): Promise<AnnouncementDecisionSnapshot | undefined> {
    return db.query.appAnnouncement.findFirst({
      where: { id: announcementId },
      columns: {
        id: true,
        enablePlatform: true,
        isRealtime: true,
        isPublished: true,
        publishStartTime: true,
        publishEndTime: true,
        updatedAt: true,
      },
    })
  }

  private async loadAnnouncementPayloadSnapshot(announcementId: number) {
    return this.db.query.appAnnouncement.findFirst({
      where: { id: announcementId },
      columns: {
        id: true,
        title: true,
        content: true,
        summary: true,
        announcementType: true,
        priorityLevel: true,
      },
    })
  }

  private resolveAnnouncementEventKey(input: {
    isRealtime: boolean
    isPublished: boolean
    enablePlatform?: number[] | null
    publishStartTime?: Date | null
    publishEndTime?: Date | null
  }): AnnouncementFanoutEventKey {
    return shouldAnnouncementEnterNotificationCenter(input) &&
      isAnnouncementPublishedNow(input)
      ? 'announcement.published'
      : 'announcement.unpublished'
  }

  private buildManualBoundaryKey(announcement: AnnouncementDecisionSnapshot) {
    return `manual:${this.formatBoundaryDate(announcement.updatedAt)}`
  }

  private buildStartBoundaryKey(publishStartTime?: Date | null) {
    return `start:${this.formatBoundaryDate(publishStartTime)}`
  }

  private buildEndBoundaryKey(publishEndTime?: Date | null) {
    return `end:${this.formatBoundaryDate(publishEndTime)}`
  }

  private isObsoleteFanoutBoundary(
    task: AppAnnouncementNotificationFanoutTaskSelect,
    announcement: AnnouncementDecisionSnapshot,
  ) {
    if (task.eventBoundaryKey.startsWith('manual:')) {
      return task.eventBoundaryKey !== this.buildManualBoundaryKey(announcement)
    }
    if (task.eventBoundaryKey.startsWith('start:')) {
      const startBoundaryKey = this.buildStartBoundaryKey(
        announcement.publishStartTime,
      )
      return (
        task.desiredEventKey !== 'announcement.published' ||
        task.eventBoundaryKey !== startBoundaryKey
      )
    }
    if (task.eventBoundaryKey.startsWith('end:')) {
      const endBoundaryKey = this.buildEndBoundaryKey(
        announcement.publishEndTime,
      )
      return (
        task.desiredEventKey !== 'announcement.unpublished' ||
        task.eventBoundaryKey !== endBoundaryKey
      )
    }
    return false
  }

  private buildFanoutKey(input: {
    announcementId: number
    desiredEventKey: AnnouncementFanoutEventKey
    eventBoundaryKey: string
  }) {
    return [
      'announcement',
      input.announcementId,
      input.desiredEventKey,
      input.eventBoundaryKey,
    ].join(':')
  }

  private formatBoundaryDate(date?: Date | null) {
    return date ? date.toISOString() : 'immediate'
  }

  private buildLeaseExpiresAt(now: Date) {
    return new Date(now.getTime() + ANNOUNCEMENT_FANOUT_CLAIM_LEASE_MS)
  }

  private buildNextAttemptAt(attemptCount: number, now: Date) {
    if (attemptCount >= ANNOUNCEMENT_FANOUT_MAX_ATTEMPTS) {
      return null
    }
    const delayMs =
      ANNOUNCEMENT_FANOUT_RETRY_BASE_MS * 2 ** Math.max(attemptCount - 1, 0)
    return new Date(now.getTime() + delayMs)
  }

  private buildAnnouncementNotificationContent(
    summary?: string | null,
    content?: string | null,
  ) {
    const value =
      summary?.trim() || content?.trim() || '你收到一条新的系统公告。'
    return value.slice(0, 180)
  }

  private buildAnnouncementNotificationContext(params: {
    announcementId: number
    receiverUserId: number
    eventKey: AnnouncementFanoutEventKey
    title?: string
    content?: string
    announcementType?: number
    priorityLevel?: number
  }) {
    const base = {
      receiverUserId: params.receiverUserId,
      projectionKey: `announcement:notify:${params.announcementId}:user:${params.receiverUserId}`,
    }

    if (params.eventKey === 'announcement.unpublished') {
      return base
    }

    return {
      ...base,
      title: params.title ?? '',
      content: params.content ?? '',
      payload: {
        object: {
          kind: 'announcement',
          id: params.announcementId,
          title: params.title ?? undefined,
          summary: params.content ?? undefined,
          announcementType: params.announcementType ?? 0,
          priorityLevel: params.priorityLevel ?? 0,
        },
      },
    }
  }

  private stringifyError<T>(error: T) {
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
