import type { MessageOutboxSelect } from '@db/schema'
import type { SQL } from 'drizzle-orm'
import type {
  NotificationDeliveryPageItem,
  UpsertNotificationDeliveryInput,
} from './notification-delivery.type'
import { buildILikeCondition, DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'
import { and, desc, eq, sql } from 'drizzle-orm'
import { QueryNotificationDeliveryPageDto } from './dto/notification.dto'
import {
  getMessageNotificationDispatchStatusLabel,
  getMessageNotificationTypeLabel,
  MESSAGE_NOTIFICATION_TYPE_VALUES,
  MessageNotificationDispatchStatusEnum,
  MessageNotificationTypeEnum,
} from './notification.constant'

/**
 * 通知投递结果服务
 * 负责持久化 outbox 对应的业务投递结果，并向管理端提供最小排障查询能力
 */
@Injectable()
export class MessageNotificationDeliveryService {
  constructor(private readonly drizzle: DrizzleService) {}

  /** 统一复用当前模块的 Drizzle 数据库实例。 */
  private get db() {
    return this.drizzle.db
  }

  /** notification_delivery 表访问入口。 */
  private get notificationDelivery() {
    return this.drizzle.schema.notificationDelivery
  }

  /** message_outbox 表访问入口，用于补充提醒 payload 上下文。 */
  private get messageOutbox() {
    return this.drizzle.schema.messageOutbox
  }

  /**
   * 依据 outbox 事件写入或更新投递结果
   * 采用一条 outbox 事件对应一条 delivery 记录的策略，重试时覆盖最新业务结果
   */
  async upsertDeliveryForOutboxEvent(
    event: Pick<MessageOutboxSelect, 'id' | 'bizKey' | 'eventType' | 'payload'>,
    input: UpsertNotificationDeliveryInput,
  ) {
    const now = input.lastAttemptAt ?? new Date()
    const notificationType = this.parseOptionalNotificationType(event.eventType)
    const receiverUserId = this.parseOptionalReceiverUserId(event.payload)
    const failureReason = this.normalizeFailureReason(input.failureReason)

    await this.drizzle.withErrorHandling(() =>
      this.db
        .insert(this.notificationDelivery)
        .values({
          outboxId: event.id,
          bizKey: event.bizKey,
          notificationType,
          receiverUserId,
          notificationId: input.notificationId ?? null,
          status: input.status,
          retryCount: input.retryCount,
          failureReason,
          lastAttemptAt: now,
        })
        .onConflictDoUpdate({
          target: this.notificationDelivery.outboxId,
          set: {
            bizKey: event.bizKey,
            notificationType,
            receiverUserId,
            notificationId: input.notificationId ?? null,
            status: input.status,
            retryCount: input.retryCount,
            failureReason,
            lastAttemptAt: now,
            updatedAt: now,
          },
        }),
    )
  }

  /**
   * 分页查询通知投递结果
   * 当前仅提供最小排障能力，按最新更新时间倒序返回业务结果
   */
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
    if (query.notificationType !== undefined) {
      conditions.push(
        eq(this.notificationDelivery.notificationType, query.notificationType),
      )
    }
    if (query.receiverUserId !== undefined) {
      conditions.push(
        eq(this.notificationDelivery.receiverUserId, query.receiverUserId),
      )
    }
    if (query.bizKey?.trim()) {
      conditions.push(
        buildILikeCondition(this.notificationDelivery.bizKey, query.bizKey)!,
      )
    }
    if (query.outboxId?.trim()) {
      try {
        conditions.push(
          eq(this.notificationDelivery.outboxId, BigInt(query.outboxId.trim())),
        )
      } catch {
        return {
          list: [],
          total: 0,
          pageIndex: query.pageIndex ?? 1,
          pageSize: query.pageSize ?? 15,
        }
      }
    }
    if (query.reminderKind?.trim()) {
      conditions.push(
        eq(
          this.notificationDelivery.notificationType,
          MessageNotificationTypeEnum.TASK_REMINDER,
        ),
      )
      conditions.push(
        sql`${this.messageOutbox.payload} -> 'payload' ->> 'reminderKind' = ${query.reminderKind.trim()}`,
      )
    }
    if (query.taskId !== undefined) {
      conditions.push(
        eq(
          this.notificationDelivery.notificationType,
          MessageNotificationTypeEnum.TASK_REMINDER,
        ),
      )
      conditions.push(
        sql`(${this.messageOutbox.payload} -> 'payload' ->> 'taskId')::int = ${query.taskId}`,
      )
    }
    if (query.assignmentId !== undefined) {
      conditions.push(
        eq(
          this.notificationDelivery.notificationType,
          MessageNotificationTypeEnum.TASK_REMINDER,
        ),
      )
      conditions.push(
        sql`(${this.messageOutbox.payload} -> 'payload' ->> 'assignmentId')::int = ${query.assignmentId}`,
      )
    }

    const page = this.normalizePage(query)
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined
    const [totalRow] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(this.notificationDelivery)
      .leftJoin(
        this.messageOutbox,
        eq(this.notificationDelivery.outboxId, this.messageOutbox.id),
      )
      .where(whereClause)

    const rows = await this.db
      .select({
        id: this.notificationDelivery.id,
        outboxId: this.notificationDelivery.outboxId,
        bizKey: this.notificationDelivery.bizKey,
        notificationType: this.notificationDelivery.notificationType,
        receiverUserId: this.notificationDelivery.receiverUserId,
        notificationId: this.notificationDelivery.notificationId,
        status: this.notificationDelivery.status,
        retryCount: this.notificationDelivery.retryCount,
        failureReason: this.notificationDelivery.failureReason,
        lastAttemptAt: this.notificationDelivery.lastAttemptAt,
        createdAt: this.notificationDelivery.createdAt,
        updatedAt: this.notificationDelivery.updatedAt,
        outboxPayload: this.messageOutbox.payload,
      })
      .from(this.notificationDelivery)
      .leftJoin(
        this.messageOutbox,
        eq(this.notificationDelivery.outboxId, this.messageOutbox.id),
      )
      .where(whereClause)
      .orderBy(
        desc(this.notificationDelivery.updatedAt),
        desc(this.notificationDelivery.id),
      )
      .limit(page.pageSize)
      .offset(page.offset)

    return {
      list: rows.map((item) => this.mapDeliveryPageItem(item)),
      total: Number(totalRow?.count ?? 0),
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
    }
  }

  /**
   * 映射投递结果分页项
   * 统一完成 bigint ID 序列化与状态/类型中文标签补充
   */
  private mapDeliveryPageItem(
    item: typeof this.notificationDelivery.$inferSelect & {
      outboxPayload?: unknown
    },
  ): NotificationDeliveryPageItem {
    const taskReminder = this.parseTaskReminderContext(item.outboxPayload)

    return {
      ...item,
      outboxId: item.outboxId.toString(),
      status: item.status as MessageNotificationDispatchStatusEnum,
      notificationTypeLabel:
        item.notificationType === null
          ? undefined
          : getMessageNotificationTypeLabel(item.notificationType),
      statusLabel: getMessageNotificationDispatchStatusLabel(
        item.status as MessageNotificationDispatchStatusEnum,
      ),
      reminderKind: taskReminder.reminderKind,
      taskId: taskReminder.taskId,
      assignmentId: taskReminder.assignmentId,
      taskCode: taskReminder.taskCode,
      sceneType: taskReminder.sceneType,
      payloadVersion: taskReminder.payloadVersion,
    }
  }

  private parseTaskReminderContext(payload: unknown) {
    const root = this.asRecord(payload)
    const notificationPayload = this.asRecord(root?.payload)
    const reminderKind =
      typeof notificationPayload?.reminderKind === 'string'
        ? notificationPayload.reminderKind
        : undefined

    if (!reminderKind) {
      return {
        reminderKind: undefined,
        taskId: undefined,
        assignmentId: undefined,
        taskCode: undefined,
        sceneType: undefined,
        payloadVersion: undefined,
      }
    }

    const notificationPayloadRecord = notificationPayload!

    return {
      reminderKind,
      taskId: this.parseOptionalPositiveInt(notificationPayloadRecord.taskId),
      assignmentId: this.parseOptionalPositiveInt(
        notificationPayloadRecord.assignmentId,
      ),
      taskCode:
        typeof notificationPayloadRecord.taskCode === 'string'
          ? notificationPayloadRecord.taskCode
          : undefined,
      sceneType: this.parseOptionalPositiveInt(notificationPayloadRecord.sceneType),
      payloadVersion: this.parseOptionalPositiveInt(
        notificationPayloadRecord.payloadVersion,
      ),
    }
  }

  /**
   * 从 outbox payload 尝试解析接收用户
   * delivery 记录不负责纠正异常 payload，只在能安全读取时保留最小排障上下文
   */
  private parseOptionalReceiverUserId(payload: unknown) {
    if (!payload || typeof payload !== 'object') {
      return null
    }
    const receiverUserId = Number(
      (payload as Record<string, unknown>).receiverUserId,
    )
    if (!Number.isInteger(receiverUserId) || receiverUserId <= 0) {
      return null
    }
    return receiverUserId
  }

  /**
   * 尝试将 outbox eventType 解析为通知类型
   * 非法值场景保留为空，避免 delivery 落表再次失败
   */
  private parseOptionalNotificationType(value: unknown) {
    const notificationType = Number(value)
    if (
      !Number.isInteger(notificationType)
      || !MESSAGE_NOTIFICATION_TYPE_VALUES.includes(notificationType)
    ) {
      return null
    }
    return notificationType as MessageNotificationTypeEnum
  }

  /**
   * 规范化失败原因
   * 跳过和成功场景保持为空；失败场景统一截断到表字段长度
   */
  private normalizeFailureReason(value?: string | null) {
    const normalized = value?.trim()
    return normalized ? normalized.slice(0, 500) : null
  }

  private normalizePage(query: QueryNotificationDeliveryPageDto) {
    const pageIndex =
      Number.isInteger(query.pageIndex) && Number(query.pageIndex) > 0
        ? Number(query.pageIndex)
        : 1
    const pageSize =
      Number.isInteger(query.pageSize) && Number(query.pageSize) > 0
        ? Math.min(Number(query.pageSize), 100)
        : 15

    return {
      pageIndex,
      pageSize,
      offset: (pageIndex - 1) * pageSize,
    }
  }

  private asRecord(input: unknown) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return null
    }
    return input as Record<string, unknown>
  }

  private parseOptionalPositiveInt(value: unknown) {
    const normalized = Number(value)
    if (!Number.isInteger(normalized) || normalized <= 0) {
      return undefined
    }
    return normalized
  }
}
