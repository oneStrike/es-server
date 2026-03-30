import type { MessageOutboxSelect } from '@db/schema'
import type { SQL } from 'drizzle-orm'
import type {
  NotificationDeliveryPageItem,
  QueryNotificationDeliveryPageInput,
  UpsertNotificationDeliveryInput,
} from './notification-delivery.type'
import type { MessageNotificationTypeEnum } from './notification.constant'
import { DrizzleService, escapeLikePattern } from '@db/core'
import { Injectable } from '@nestjs/common'
import { and, eq, ilike } from 'drizzle-orm'
import {
  getMessageNotificationDispatchStatusLabel,
  getMessageNotificationTypeLabel,
  MESSAGE_NOTIFICATION_TYPE_VALUES,
  MessageNotificationDispatchStatusEnum,
} from './notification.constant'

/**
 * 通知投递结果服务
 * 负责持久化 outbox 对应的业务投递结果，并向管理端提供最小排障查询能力
 */
@Injectable()
export class MessageNotificationDeliveryService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get notificationDelivery() {
    return this.drizzle.schema.notificationDelivery
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
    query: QueryNotificationDeliveryPageInput,
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
        ilike(
          this.notificationDelivery.bizKey,
          `%${escapeLikePattern(query.bizKey.trim())}%`,
        ),
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

    const page = await this.drizzle.ext.findPagination(this.notificationDelivery, {
      where: conditions.length > 0 ? and(...conditions) : undefined,
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
      orderBy: [
        { updatedAt: 'desc' as const },
        { id: 'desc' as const },
      ],
    })

    return {
      ...page,
      list: page.list.map((item) => this.mapDeliveryPageItem(item)),
    }
  }

  /**
   * 映射投递结果分页项
   * 统一完成 bigint ID 序列化与状态/类型中文标签补充
   */
  private mapDeliveryPageItem(
    item: typeof this.notificationDelivery.$inferSelect,
  ): NotificationDeliveryPageItem {
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
}
