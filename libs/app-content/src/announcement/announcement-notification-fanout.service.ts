import type { AppAnnouncementNotificationFanoutTaskSelect } from '@db/schema'
import { DrizzleService } from '@db/core'
import { MessageDomainEventPublisher } from '@libs/message/eventing/message-domain-event.publisher'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, asc, eq, gt, inArray, isNull, sql } from 'drizzle-orm'
import {
  isAnnouncementPublishedNow,
  shouldAnnouncementEnterNotificationCenter,
} from './announcement.constant'

const ANNOUNCEMENT_FANOUT_BATCH_SIZE = 200
const ANNOUNCEMENT_FANOUT_PENDING_STATUS = 0
const ANNOUNCEMENT_FANOUT_PROCESSING_STATUS = 1
const ANNOUNCEMENT_FANOUT_SUCCESS_STATUS = 2
const ANNOUNCEMENT_FANOUT_FAILED_STATUS = 3
const ANNOUNCEMENT_FANOUT_RUNNABLE_STATUSES = [
  ANNOUNCEMENT_FANOUT_PENDING_STATUS,
  ANNOUNCEMENT_FANOUT_FAILED_STATUS,
] as const

@Injectable()
export class AnnouncementNotificationFanoutService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly messageDomainEventPublisher: MessageDomainEventPublisher,
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

  async enqueueAnnouncementFanout(announcementId: number) {
    const announcement = await this.loadAnnouncementDecisionSnapshot(announcementId)
    if (!announcement) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '公告不存在',
      )
    }

    const desiredEventKey = this.resolveAnnouncementEventKey(announcement)
    const now = new Date()
    await this.drizzle.withErrorHandling(() =>
      this.db
        .insert(this.fanoutTask)
        .values({
          announcementId,
          desiredEventKey,
          status: ANNOUNCEMENT_FANOUT_PENDING_STATUS,
          cursorUserId: null,
          lastError: null,
          startedAt: null,
          finishedAt: null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: this.fanoutTask.announcementId,
          set: {
            desiredEventKey,
            status: ANNOUNCEMENT_FANOUT_PENDING_STATUS,
            cursorUserId: null,
            lastError: null,
            startedAt: null,
            finishedAt: null,
            updatedAt: now,
          },
        }),
    )
    return true
  }

  async consumePendingTasks() {
    while (true) {
      const task = await this.claimNextRunnableTask()
      if (!task) {
        return
      }

      await this.processTask(task)
    }
  }

  private async processTask(task: AppAnnouncementNotificationFanoutTaskSelect) {
    const announcement = await this.loadAnnouncementPayloadSnapshot(task.announcementId)
    if (task.desiredEventKey === 'announcement.published' && !announcement) {
      await this.markTaskFailed(task.id, task.desiredEventKey, task.cursorUserId, 'announcement_not_found')
      return
    }

    let cursorUserId = task.cursorUserId ?? undefined

    while (true) {
      const receiverUserIds =
        task.desiredEventKey === 'announcement.published'
          ? await this.loadPublishedReceiverUserIds(cursorUserId)
          : await this.loadUnpublishedReceiverUserIds(task.announcementId, cursorUserId)

      if (receiverUserIds.length === 0) {
        await this.markTaskSucceeded(task.id, task.desiredEventKey)
        return
      }

      let lastProcessedUserId = cursorUserId ?? null

      try {
        for (const receiverUserId of receiverUserIds) {
          await this.messageDomainEventPublisher.publish({
            eventKey: task.desiredEventKey as 'announcement.published' | 'announcement.unpublished',
            subjectType: 'system',
            subjectId: task.announcementId,
            targetType: 'announcement',
            targetId: task.announcementId,
            context: this.buildAnnouncementNotificationContext({
              announcementId: task.announcementId,
              receiverUserId,
              eventKey: task.desiredEventKey,
              title: announcement?.title,
              content: announcement
                ? this.buildAnnouncementNotificationContent(
                    announcement.summary,
                    announcement.content,
                  )
                : undefined,
              announcementType: announcement?.announcementType,
              priorityLevel: announcement?.priorityLevel,
            }),
          })
          lastProcessedUserId = receiverUserId
        }
      } catch (error) {
        await this.markTaskFailed(
          task.id,
          task.desiredEventKey,
          lastProcessedUserId,
          this.stringifyError(error),
        )
        return
      }

      const nextCursorUserId = receiverUserIds.at(-1) ?? lastProcessedUserId
      const advanced = await this.advanceTaskCursor(
        task.id,
        task.desiredEventKey,
        nextCursorUserId ?? null,
      )
      if (!advanced) {
        return
      }
      cursorUserId = nextCursorUserId ?? undefined
    }
  }

  private async claimNextRunnableTask() {
    const rows = await this.db
      .select()
      .from(this.fanoutTask)
      .where(inArray(this.fanoutTask.status, [...ANNOUNCEMENT_FANOUT_RUNNABLE_STATUSES]))
      .orderBy(asc(this.fanoutTask.updatedAt), asc(this.fanoutTask.id))
      .limit(1)

    const pendingTask = rows[0]
    if (!pendingTask) {
      return null
    }

    const now = new Date()
    const claimedRows = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.fanoutTask)
        .set({
          status: ANNOUNCEMENT_FANOUT_PROCESSING_STATUS,
          startedAt: pendingTask.startedAt ?? now,
          finishedAt: null,
          lastError: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(this.fanoutTask.id, pendingTask.id),
            inArray(this.fanoutTask.status, [
              ...ANNOUNCEMENT_FANOUT_RUNNABLE_STATUSES,
            ]),
          ),
        )
        .returning(),
    )

    return claimedRows[0] ?? null
  }

  private async advanceTaskCursor(
    taskId: number,
    desiredEventKey: string,
    cursorUserId: number | null,
  ) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.fanoutTask)
        .set({
          cursorUserId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(this.fanoutTask.id, taskId),
            eq(this.fanoutTask.status, ANNOUNCEMENT_FANOUT_PROCESSING_STATUS),
            eq(this.fanoutTask.desiredEventKey, desiredEventKey),
          ),
        ),
    )

    return (result.rowCount ?? 0) > 0
  }

  private async markTaskSucceeded(taskId: number, desiredEventKey: string) {
    const now = new Date()
    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.fanoutTask)
        .set({
          status: ANNOUNCEMENT_FANOUT_SUCCESS_STATUS,
          cursorUserId: null,
          lastError: null,
          finishedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(this.fanoutTask.id, taskId),
            eq(this.fanoutTask.status, ANNOUNCEMENT_FANOUT_PROCESSING_STATUS),
            eq(this.fanoutTask.desiredEventKey, desiredEventKey),
          ),
        ),
    )
  }

  private async markTaskFailed(
    taskId: number,
    desiredEventKey: string,
    cursorUserId: number | null,
    reason: string,
  ) {
    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.fanoutTask)
        .set({
          status: ANNOUNCEMENT_FANOUT_FAILED_STATUS,
          cursorUserId,
          lastError: reason.slice(0, 500),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(this.fanoutTask.id, taskId),
            eq(this.fanoutTask.status, ANNOUNCEMENT_FANOUT_PROCESSING_STATUS),
            eq(this.fanoutTask.desiredEventKey, desiredEventKey),
          ),
        ),
    )
  }

  private async loadPublishedReceiverUserIds(cursorUserId?: number) {
    const conditions = [
      eq(this.appUser.isEnabled, true),
      isNull(this.appUser.deletedAt),
      cursorUserId !== undefined ? gt(this.appUser.id, cursorUserId) : undefined,
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
    const projectionKeyPrefix = `announcement:notify:${announcementId}:user:%`
    const conditions = [
      eq(this.userNotification.categoryKey, 'system_announcement'),
      sql`${this.userNotification.projectionKey} like ${projectionKeyPrefix}`,
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

  private async loadAnnouncementDecisionSnapshot(announcementId: number) {
    return this.db.query.appAnnouncement.findFirst({
      where: { id: announcementId },
      columns: {
        id: true,
        priorityLevel: true,
        isPinned: true,
        showAsPopup: true,
        isPublished: true,
        publishStartTime: true,
        publishEndTime: true,
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
    priorityLevel: number
    isPinned: boolean
    showAsPopup: boolean
    isPublished: boolean
    publishStartTime?: Date | null
    publishEndTime?: Date | null
  }) {
    return shouldAnnouncementEnterNotificationCenter(input)
      && isAnnouncementPublishedNow(input)
      ? 'announcement.published'
      : 'announcement.unpublished'
  }

  private buildAnnouncementNotificationContent(
    summary?: string | null,
    content?: string | null,
  ) {
    const value =
      summary?.trim() || content?.trim() || '你收到一条新的重要公告。'
    return value.slice(0, 180)
  }

  private buildAnnouncementNotificationContext(params: {
    announcementId: number
    receiverUserId: number
    eventKey: string
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
        title: params.title ?? '',
        content: params.content ?? '',
        announcementId: params.announcementId,
        announcementType: params.announcementType ?? 0,
        priorityLevel: params.priorityLevel ?? 0,
      },
    }
  }

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
