import type {
  DomainEventDispatchRecord,
  DomainEventRecord,
} from '@libs/platform/modules/eventing/domain-event.type'
import type { SQL } from 'drizzle-orm'
import type {
  MessageDomainEventKey,
  NotificationProjectionApplyResult,
} from '../eventing/message-event.type'
import type { QueryNotificationDeliveryPageDto } from './dto/notification.dto'
import type { MessageNotificationCategoryKey } from './notification.type'
import { DrizzleService, toPageResult } from '@db/core'

import { buildDateOnlyRangeInAppTimeZone, jsonParse } from '@libs/platform/utils'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, asc, desc, eq, gte, lt } from 'drizzle-orm'
import {
  getMessageDomainEventDefinition,
  getMessageDomainEventLabel,
} from '../eventing/message-event.constant'
import { parsePositiveBigintQueryId } from './notification-query-id.util'
import {
  getMessageNotificationCategoryLabel,
  getMessageNotificationDispatchStatusLabel,
  MESSAGE_NOTIFICATION_CATEGORY_KEYS,
  MessageNotificationDispatchStatusEnum,
} from './notification.constant'

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
      instanceId: taskReminderFacts.instanceId,
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
      instanceId: taskReminderFacts.instanceId,
      reminderKind: taskReminderFacts.reminderKind,
    })
  }

  async getNotificationDeliveryPage(query: QueryNotificationDeliveryPageDto) {
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
    if (query.receiverUserId != null) {
      conditions.push(
        eq(this.notificationDelivery.receiverUserId, query.receiverUserId),
      )
    }
    if (query.projectionKey?.trim()) {
      conditions.push(
        eq(this.notificationDelivery.projectionKey, query.projectionKey.trim()),
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
    const dateRange = buildDateOnlyRangeInAppTimeZone(
      query.startDate,
      query.endDate,
    )
    if (dateRange?.gte) {
      conditions.push(gte(this.notificationDelivery.updatedAt, dateRange.gte))
    }
    if (dateRange?.lt) {
      conditions.push(lt(this.notificationDelivery.updatedAt, dateRange.lt))
    }

    const page = this.drizzle.buildPage(query, {
      defaultPageSize: 15,
      maxPageSize: 100,
    })
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined
    const orderBySql = this.buildDeliveryOrderBy(
      query.orderBy?.trim()
        ? query.orderBy
        : [{ updatedAt: 'desc' as const }, { id: 'desc' as const }],
    )

    const [total, rows] = await Promise.all([
      this.db.$count(this.notificationDelivery, whereClause),
      this.db
        .select()
        .from(this.notificationDelivery)
        .where(whereClause)
        .orderBy(...orderBySql)
        .limit(page.limit)
        .offset(page.offset),
    ])

    return toPageResult(
      rows.map((item) => ({
        ...item,
        eventId: item.eventId.toString(),
        dispatchId: item.dispatchId.toString(),
        eventLabel: getMessageDomainEventLabel(item.eventKey),
        failureReason: this.sanitizeDiagnosticText(item.failureReason),
        fallbackReason: this.sanitizeDiagnosticText(item.fallbackReason),
        categoryLabel:
          item.categoryKey &&
          MESSAGE_NOTIFICATION_CATEGORY_KEYS.includes(
            item.categoryKey as MessageNotificationCategoryKey,
          )
            ? getMessageNotificationCategoryLabel(
                item.categoryKey as MessageNotificationCategoryKey,
              )
            : null,
        statusLabel: getMessageNotificationDispatchStatusLabel(
          item.status,
        ),
      })),
      total,
      page,
    )
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
    instanceId?: number
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
          instanceId: input.instanceId ?? null,
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
            instanceId: input.instanceId ?? null,
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
    // 查询条件专用：空字符串按"不筛选"处理，返回 undefined 让 Drizzle where 跳过该条件。
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
        instanceId: undefined,
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
      instanceId: this.parseOptionalReceiverUserId(reminder?.instanceId),
      reminderKind: this.parseOptionalString(reminder?.kind),
    }
  }

  private assertRequiredTaskReminderProjectionFacts(
    categoryKey: string | undefined,
    facts: {
      taskId?: number
      instanceId?: number
      reminderKind?: string
    },
  ) {
    if (
      categoryKey === 'task_reminder' &&
      (typeof facts.taskId !== 'number' ||
        typeof facts.instanceId !== 'number' ||
        typeof facts.reminderKind !== 'string')
    ) {
      throw new Error(
        'task_reminder delivery must provide taskId, instanceId and reminderKind typed lookup facts',
      )
    }
  }

  private normalizeFailureReason(value?: string | null) {
    const normalized = value?.trim()
    return normalized ? normalized.slice(0, 500) : null
  }

  private sanitizeDiagnosticText(value?: string | null) {
    const normalized = value?.replace(/\s+/g, ' ').trim()
    return normalized ? normalized.slice(0, 120) : null
  }

  private buildDeliveryOrderBy(input: unknown) {
    const records = this.normalizeOrderByRecords(input)
    const columns = {
      updatedAt: this.notificationDelivery.updatedAt,
      createdAt: this.notificationDelivery.createdAt,
      lastAttemptAt: this.notificationDelivery.lastAttemptAt,
      id: this.notificationDelivery.id,
    } as const
    const orderBySql = records.map((record) => {
      const [field, direction] = Object.entries(record)[0] ?? []
      const column = columns[field as keyof typeof columns]
      if (!column) {
        throw new BadRequestException(`排序字段 "${field}" 不支持`)
      }
      return direction === 'asc' ? asc(column) : desc(column)
    })
    return records.some((record) => Object.hasOwn(record, 'id'))
      ? orderBySql
      : [...orderBySql, desc(this.notificationDelivery.id)]
  }

  private normalizeOrderByRecords(input: unknown) {
    const parsed =
      typeof input === 'string'
        ? jsonParse<Record<string, string>[]>(input)
        : input
    const records = Array.isArray(parsed) ? parsed : [parsed]
    return records.map((record) => {
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        throw new BadRequestException('orderBy 参数格式不合法')
      }
      const entries = Object.entries(record as Record<string, unknown>)
      if (entries.length !== 1) {
        throw new BadRequestException('orderBy 每项只能包含一个排序字段')
      }
      const [field, direction] = entries[0]
      if (direction !== 'asc' && direction !== 'desc') {
        throw new BadRequestException(`排序字段 "${field}" 的排序方向无效`)
      }
      return { [field]: direction }
    })
  }
}
