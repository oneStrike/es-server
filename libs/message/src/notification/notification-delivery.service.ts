import type {
  DomainEventDispatchRecord,
  DomainEventRecord,
} from '@libs/platform/modules/eventing'
import type { SQL } from 'drizzle-orm'
import type { NotificationProjectionApplyResult } from '../eventing/message-event.type'
import type { NotificationDeliveryPageItem } from './notification-delivery.type'
import { DrizzleService } from '@db/core'

import { Injectable } from '@nestjs/common'
import { and, desc, eq, sql } from 'drizzle-orm'
import {
  getMessageDomainEventDefinition,
  MessageDomainEventKey,
} from '../eventing/message-event.constant'
import { QueryNotificationDeliveryPageDto } from './dto/notification.dto'
import {
  getMessageNotificationCategoryLabel,
  getMessageNotificationDispatchStatusLabel,
  MESSAGE_NOTIFICATION_CATEGORY_KEYS,
  MessageNotificationCategoryKey,
  MessageNotificationDispatchStatusEnum,
} from './notification.constant'
import { parsePositiveBigintQueryId } from './notification-query-id.util'

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

@Injectable()
export class MessageNotificationDeliveryService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get notificationDelivery() {
    return this.drizzle.schema.notificationDelivery
  }

  private get domainEvent() {
    return this.drizzle.schema.domainEvent
  }

  async recordHandledDispatch(
    event: DomainEventRecord,
    dispatch: DomainEventDispatchRecord,
    result: NotificationProjectionApplyResult,
  ) {
    const notification = (result.notification ?? null) as {
      id?: number
      categoryKey?: string
      projectionKey?: string
      receiverUserId?: number
    } | null

    const categoryKey =
      typeof notification?.categoryKey === 'string'
        ? notification.categoryKey
        : this.resolveEventCategoryKey(event)
    const projectionKey =
      typeof notification?.projectionKey === 'string'
        ? notification.projectionKey
        : result.projectionKey
    const receiverUserId =
      typeof notification?.receiverUserId === 'number'
        ? notification.receiverUserId
        : result.receiverUserId
    const status = this.resolveHandledStatus(result)
    const failureReason = result.action === 'skip' ? result.reason : undefined
    const taskReminderFacts = this.extractTaskReminderProjectionFacts(
      event,
      categoryKey,
    )
    this.assertRequiredTaskReminderProjectionFacts(
      categoryKey,
      taskReminderFacts,
    )

    await this.upsertDeliveryRecord({
      event,
      dispatch,
      receiverUserId,
      projectionKey,
      categoryKey,
      notificationId:
        typeof notification?.id === 'number' ? notification.id : null,
      status,
      templateId: result.templateId ?? null,
      usedTemplate: result.usedTemplate ?? false,
      fallbackReason: result.fallbackReason ?? null,
      failureReason,
      taskId: taskReminderFacts.taskId,
      assignmentId: taskReminderFacts.assignmentId,
      reminderKind: taskReminderFacts.reminderKind,
    })
  }

  async recordFailedDispatch(
    event: DomainEventRecord,
    dispatch: DomainEventDispatchRecord,
    input: {
      status:
        | MessageNotificationDispatchStatusEnum.FAILED
        | MessageNotificationDispatchStatusEnum.RETRYING
      failureReason?: string | null
    },
  ) {
    const categoryKey = this.resolveEventCategoryKey(event)
    const projectionKey = this.parseOptionalString(event.context?.projectionKey)
    const receiverUserId = this.parseOptionalReceiverUserId(
      event.context?.receiverUserId,
    )
    const taskReminderFacts = this.extractTaskReminderProjectionFacts(
      event,
      categoryKey,
    )
    this.assertRequiredTaskReminderProjectionFacts(
      categoryKey,
      taskReminderFacts,
    )

    await this.upsertDeliveryRecord({
      event,
      dispatch,
      receiverUserId,
      projectionKey,
      categoryKey,
      notificationId: null,
      status: input.status,
      templateId: null,
      usedTemplate: false,
      fallbackReason: null,
      failureReason: input.failureReason,
      taskId: taskReminderFacts.taskId,
      assignmentId: taskReminderFacts.assignmentId,
      reminderKind: taskReminderFacts.reminderKind,
    })
  }

  async getNotificationDeliveryPage(
    query: QueryNotificationDeliveryPageDto,
  ): Promise<{
    list: NotificationDeliveryPageItem[]
    total: number
    pageIndex: number
    pageSize: number
  }> {
    const conditions: SQL[] = []

    if (query.status) {
      conditions.push(eq(this.notificationDelivery.status, query.status))
    }
    if (query.categoryKey?.trim()) {
      conditions.push(
        eq(
          this.notificationDelivery.categoryKey,
          query.categoryKey.trim() as MessageNotificationCategoryKey,
        ),
      )
    }
    if (query.eventKey?.trim()) {
      conditions.push(
        eq(this.notificationDelivery.eventKey, query.eventKey.trim()),
      )
    }
    if (query.receiverUserId !== undefined) {
      conditions.push(
        eq(this.notificationDelivery.receiverUserId, query.receiverUserId),
      )
    }
    if (query.projectionKey?.trim()) {
      conditions.push(
        eq(
          this.notificationDelivery.projectionKey,
          query.projectionKey.trim(),
        )!,
      )
    }
    if (query.eventId?.trim()) {
      conditions.push(
        eq(
          this.notificationDelivery.eventId,
          parsePositiveBigintQueryId(query.eventId, 'eventId'),
        ),
      )
    }
    if (query.dispatchId?.trim()) {
      conditions.push(
        eq(
          this.notificationDelivery.dispatchId,
          parsePositiveBigintQueryId(query.dispatchId, 'dispatchId'),
        ),
      )
    }

    const pageIndex =
      Number.isInteger(query.pageIndex) && Number(query.pageIndex) > 0
        ? Number(query.pageIndex)
        : 1
    const pageSize =
      Number.isInteger(query.pageSize) && Number(query.pageSize) > 0
        ? Math.min(Number(query.pageSize), 100)
        : 15
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [totalRow] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(this.notificationDelivery)
      .where(whereClause)

    const rows = await this.db
      .select()
      .from(this.notificationDelivery)
      .where(whereClause)
      .orderBy(
        desc(this.notificationDelivery.updatedAt),
        desc(this.notificationDelivery.id),
      )
      .limit(pageSize)
      .offset((pageIndex - 1) * pageSize)

    return {
      list: rows.map((item) => ({
        ...item,
        eventId: item.eventId.toString(),
        dispatchId: item.dispatchId.toString(),
        status: item.status as MessageNotificationDispatchStatusEnum,
        categoryLabel:
          item.categoryKey &&
          MESSAGE_NOTIFICATION_CATEGORY_KEYS.includes(
            item.categoryKey as MessageNotificationCategoryKey,
          )
            ? getMessageNotificationCategoryLabel(
                item.categoryKey as MessageNotificationCategoryKey,
              )
            : undefined,
        statusLabel: getMessageNotificationDispatchStatusLabel(
          item.status as MessageNotificationDispatchStatusEnum,
        ),
      })),
      total: Number(totalRow?.count ?? 0),
      pageIndex,
      pageSize,
    }
  }

  private async upsertDeliveryRecord(input: {
    event: DomainEventRecord
    dispatch: DomainEventDispatchRecord
    receiverUserId?: number
    projectionKey?: string
    categoryKey?: string
    notificationId: number | null
    status: MessageNotificationDispatchStatusEnum
    templateId: number | null
    usedTemplate: boolean
    fallbackReason: string | null
    failureReason?: string | null
    taskId?: number
    assignmentId?: number
    reminderKind?: string
  }) {
    const attemptedAt = new Date()

    await this.drizzle.withErrorHandling(() =>
      this.db
        .insert(this.notificationDelivery)
        .values({
          eventId: input.event.id,
          dispatchId: input.dispatch.id,
          eventKey: input.event.eventKey,
          receiverUserId: input.receiverUserId ?? null,
          projectionKey: input.projectionKey ?? null,
          categoryKey: input.categoryKey ?? null,
          taskId: input.taskId ?? null,
          assignmentId: input.assignmentId ?? null,
          reminderKind: input.reminderKind ?? null,
          notificationId: input.notificationId,
          status: input.status,
          templateId: input.templateId,
          usedTemplate: input.usedTemplate,
          fallbackReason: input.fallbackReason,
          failureReason: this.normalizeFailureReason(input.failureReason),
          lastAttemptAt: attemptedAt,
        })
        .onConflictDoUpdate({
          target: this.notificationDelivery.dispatchId,
          set: {
            eventKey: input.event.eventKey,
            receiverUserId: input.receiverUserId ?? null,
            projectionKey: input.projectionKey ?? null,
            categoryKey: input.categoryKey ?? null,
            taskId: input.taskId ?? null,
            assignmentId: input.assignmentId ?? null,
            reminderKind: input.reminderKind ?? null,
            notificationId: input.notificationId,
            status: input.status,
            templateId: input.templateId,
            usedTemplate: input.usedTemplate,
            fallbackReason: input.fallbackReason,
            failureReason: this.normalizeFailureReason(input.failureReason),
            lastAttemptAt: attemptedAt,
            updatedAt: attemptedAt,
          },
        }),
    )
  }

  private resolveHandledStatus(result: NotificationProjectionApplyResult) {
    if (result.action !== 'skip') {
      return MessageNotificationDispatchStatusEnum.DELIVERED
    }

    return result.reason === 'preference_disabled'
      ? MessageNotificationDispatchStatusEnum.SKIPPED_PREFERENCE
      : MessageNotificationDispatchStatusEnum.FAILED
  }

  private parseOptionalReceiverUserId<T>(value: T) {
    const receiverUserId = Number(value)
    if (!Number.isInteger(receiverUserId) || receiverUserId <= 0) {
      return undefined
    }
    return receiverUserId
  }

  private parseOptionalString<T>(value: T) {
    if (typeof value !== 'string') {
      return undefined
    }
    const normalized = value.trim()
    return normalized || undefined
  }

  private parseOptionalCategoryKey<T>(value: T) {
    const normalized = this.parseOptionalString(value)
    if (!normalized) {
      return undefined
    }
    return MESSAGE_NOTIFICATION_CATEGORY_KEYS.includes(
      normalized as MessageNotificationCategoryKey,
    )
      ? normalized
      : undefined
  }

  private resolveEventCategoryKey(event: DomainEventRecord) {
    const categoryKey = this.parseOptionalCategoryKey(
      event.context?.categoryKey,
    )
    if (categoryKey) {
      return categoryKey
    }

    try {
      const definition = getMessageDomainEventDefinition(
        event.eventKey as MessageDomainEventKey,
      )
      return 'notification' in definition
        ? definition.notification?.categoryKey
        : undefined
    } catch {
      return undefined
    }
  }

  private extractTaskReminderProjectionFacts(
    event: DomainEventRecord,
    categoryKey?: string,
  ) {
    if (categoryKey !== 'task_reminder') {
      return {
        taskId: undefined,
        assignmentId: undefined,
        reminderKind: undefined,
      }
    }

    const payload = isPlainRecord(event.context?.payload)
      ? event.context?.payload
      : undefined
    const object = isPlainRecord(payload?.object) ? payload.object : undefined
    const reminder = isPlainRecord(payload?.reminder)
      ? payload.reminder
      : undefined

    return {
      taskId:
        this.parseOptionalReceiverUserId(object?.id) ??
        this.parseOptionalReceiverUserId(event.targetId),
      assignmentId: this.parseOptionalReceiverUserId(reminder?.assignmentId),
      reminderKind: this.parseOptionalString(reminder?.kind),
    }
  }

  private assertRequiredTaskReminderProjectionFacts(
    categoryKey: string | undefined,
    facts: {
      taskId?: number
      assignmentId?: number
      reminderKind?: string
    },
  ) {
    if (
      categoryKey === 'task_reminder' &&
      (typeof facts.taskId !== 'number' ||
        typeof facts.assignmentId !== 'number' ||
        typeof facts.reminderKind !== 'string')
    ) {
      throw new Error(
        'task_reminder delivery must provide taskId, assignmentId and reminderKind typed lookup facts',
      )
    }
  }

  private normalizeFailureReason(value?: string | null) {
    const normalized = value?.trim()
    return normalized ? normalized.slice(0, 500) : null
  }
}
