import type { MessageChatService } from '../chat/chat.service'
import type {
  ChatMessageCreatedOutboxPayload,
  NotificationOutboxPayload,
} from './outbox.type'
import { DrizzleService } from '@db/core'
import { Injectable, Logger } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { Cron } from '@nestjs/schedule'
import { and, asc, eq, isNull, lte, or } from 'drizzle-orm'
import {
  ChatOutboxEventTypeEnum,
  MESSAGE_CHAT_SERVICE_TOKEN,
} from '../chat/chat.constant'
import { MessageNotificationDeliveryService } from '../notification/notification-delivery.service'
import { MessageNotificationDispatchStatusEnum } from '../notification/notification.constant'
import { MessageNotificationService } from '../notification/notification.service'
import {
  MESSAGE_OUTBOX_BATCH_SIZE,
  MESSAGE_OUTBOX_MAX_RETRY,
  MESSAGE_OUTBOX_PROCESSING_TIMEOUT_SECONDS,
  MessageOutboxDomainEnum,
  MessageOutboxStatusEnum,
} from './outbox.constant'

@Injectable()
export class MessageOutboxWorker {
  private readonly logger = new Logger(MessageOutboxWorker.name)
  private messageChatService?: MessageChatService

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly messageNotificationService: MessageNotificationService,
    private readonly messageNotificationDeliveryService: MessageNotificationDeliveryService,
    private readonly moduleRef: ModuleRef,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get outbox() {
    return this.drizzle.schema.messageOutbox
  }

  /**
   * 轮询消费 outbox 事件
   * 先抢占处理锁，再按领域分发；通知域会在技术消费成功后补写 delivery 业务结果
   */
  @Cron('*/5 * * * * *')
  async consumeOutbox() {
    const now = new Date()

    await this.recoverStaleProcessingEvents(now)

    const events = await this.db
      .select()
      .from(this.outbox)
      .where(and(
        eq(this.outbox.status, MessageOutboxStatusEnum.PENDING),
        or(
          isNull(this.outbox.nextRetryAt),
          lte(this.outbox.nextRetryAt, now),
        ),
      ))
      .orderBy(asc(this.outbox.id))
      .limit(MESSAGE_OUTBOX_BATCH_SIZE)

    if (!events.length) {
      return
    }

    for (const event of events) {
      const processingDeadline = this.buildProcessingDeadline()

      const lockResult = await this.db
        .update(this.outbox)
        .set({
          status: MessageOutboxStatusEnum.PROCESSING,
          nextRetryAt: processingDeadline,
        })
        .where(and(
          eq(this.outbox.id, event.id),
          eq(this.outbox.status, MessageOutboxStatusEnum.PENDING),
        ))
        .returning({ id: this.outbox.id })
      if (lockResult.length === 0) {
        continue
      }

      try {
        const deliveryResult = await this.processEvent(event)
        const processedAt = new Date()
        const updated = await this.db
          .update(this.outbox)
          .set({
            status: MessageOutboxStatusEnum.SUCCESS,
            processedAt,
            nextRetryAt: null,
            lastError: null,
          })
          .where(eq(this.outbox.id, event.id))
        this.drizzle.assertAffectedRows(updated, 'Outbox 事件不存在')
        if (deliveryResult) {
          await this.tryRecordNotificationDeliveryResult(event, {
            status: deliveryResult.status,
            retryCount: event.retryCount,
            notificationId: deliveryResult.notification?.id,
            lastAttemptAt: processedAt,
          })
        }
      } catch (error) {
        await this.handleProcessError(event, error)
      }
    }
  }

  /**
   * 恢复超时未完成的 processing 事件
   * 这里只回收技术锁，不额外写 delivery，避免把“未确认的业务结果”误记成一次新投递
   */
  private async recoverStaleProcessingEvents(now: Date) {
    const recovered = await this.db
      .update(this.outbox)
      .set({
        status: MessageOutboxStatusEnum.PENDING,
        lastError: 'processing timeout recovered',
      })
      .where(and(
        eq(this.outbox.status, MessageOutboxStatusEnum.PROCESSING),
        lte(this.outbox.nextRetryAt, now),
      ))
      .returning({ id: this.outbox.id })

    if (recovered.length > 0) {
      this.logger.warn(
        `Recovered stale processing outbox events: ${recovered.length}`,
      )
    }
  }

  /**
   * 构建 processing 锁的过期时间
   * worker 崩溃或超时后会依赖该时间点回收卡死任务
   */
  private buildProcessingDeadline() {
    const deadline = new Date()
    deadline.setSeconds(
      deadline.getSeconds() + MESSAGE_OUTBOX_PROCESSING_TIMEOUT_SECONDS,
    )
    return deadline
  }

  /**
   * 按领域分发 outbox 事件
   * 通知域会返回 delivery 业务结果；CHAT 域只消费实时 fanout，不写 notification_delivery
   */
  private async processEvent(event: typeof this.outbox.$inferSelect) {
    if (event.domain === MessageOutboxDomainEnum.NOTIFICATION) {
      return this.processNotificationEvent(event)
    }
    if (event.domain === MessageOutboxDomainEnum.CHAT) {
      await this.processChatEvent(event)
      return null
    }
    throw new Error(`Unsupported outbox domain: ${event.domain}`)
  }

  /**
   * 处理通知域 outbox 事件
   * payload 非法时直接抛错，由统一重试/失败逻辑接管
   */
  private async processNotificationEvent(event: typeof this.outbox.$inferSelect) {
    if (!event.payload || typeof event.payload !== 'object') {
      throw new Error('Invalid notification payload')
    }
    return this.messageNotificationService.createFromOutbox(
      event.bizKey,
      event.payload as unknown as NotificationOutboxPayload,
    )
  }

  /**
   * 处理 CHAT 域 outbox 事件。
   * 仅负责聊天消息落库后的实时 fanout / inbox 摘要同步，不复用通知 delivery 语义。
   */
  private async processChatEvent(event: typeof this.outbox.$inferSelect) {
    if (event.eventType !== ChatOutboxEventTypeEnum.MESSAGE_CREATED) {
      throw new Error(`Unsupported chat outbox event type: ${event.eventType}`)
    }
    if (!event.payload || typeof event.payload !== 'object') {
      throw new Error('Invalid chat payload')
    }

    await this.getMessageChatService().dispatchMessageCreatedOutboxEvent(
      event.payload as ChatMessageCreatedOutboxPayload,
    )
  }

  /**
   * 处理消费失败
   * 重试中与最终失败会分别写入 RETRYING / FAILED，便于运营区分技术失败与终态失败
   */
  private async handleProcessError(
    event: typeof this.outbox.$inferSelect,
    error: unknown,
  ) {
    const retryCount = event.retryCount + 1
    const message = this.stringifyError(error).slice(0, 500)
    const attemptedAt = new Date()

    if (retryCount >= MESSAGE_OUTBOX_MAX_RETRY) {
      const updated = await this.db
        .update(this.outbox)
        .set({
          status: MessageOutboxStatusEnum.FAILED,
          retryCount,
          lastError: message,
          processedAt: attemptedAt,
        })
        .where(eq(this.outbox.id, event.id))
      this.drizzle.assertAffectedRows(updated, 'Outbox 事件不存在')
      await this.tryRecordNotificationDeliveryResult(event, {
        status: MessageNotificationDispatchStatusEnum.FAILED,
        retryCount,
        failureReason: message,
        lastAttemptAt: attemptedAt,
      })
      this.logger.error(`Outbox event permanently failed: id=${event.id}, error=${message}`)
      return
    }

    const nextRetryAt = new Date()
    const backoffSeconds = Math.min(300, 2 ** retryCount)
    nextRetryAt.setSeconds(nextRetryAt.getSeconds() + backoffSeconds)

    const updated = await this.db
      .update(this.outbox)
      .set({
        status: MessageOutboxStatusEnum.PENDING,
        retryCount,
        nextRetryAt,
        lastError: message,
      })
      .where(eq(this.outbox.id, event.id))
    this.drizzle.assertAffectedRows(updated, 'Outbox 事件不存在')
    await this.tryRecordNotificationDeliveryResult(event, {
      status: MessageNotificationDispatchStatusEnum.RETRYING,
      retryCount,
      failureReason: message,
      lastAttemptAt: attemptedAt,
    })
    this.logger.warn(
      `Outbox retry scheduled: id=${event.id}, retry=${retryCount}, error=${message}`,
    )
  }

  /**
   * 最小化写入通知 delivery 结果
   * 该表仅服务排障与运营观察，写失败时记录日志但不回滚主 outbox 链路
   */
  private async tryRecordNotificationDeliveryResult(
    event: typeof this.outbox.$inferSelect,
    input: Parameters<
      MessageNotificationDeliveryService['upsertDeliveryForOutboxEvent']
    >[1],
  ) {
    if (event.domain !== MessageOutboxDomainEnum.NOTIFICATION) {
      return
    }

    try {
      await this.messageNotificationDeliveryService.upsertDeliveryForOutboxEvent(
        event,
        input,
      )
    } catch (error) {
      this.logger.error(
        `Failed to record notification delivery: outboxId=${event.id}, bizKey=${event.bizKey}, reason=${this.stringifyError(error)}`,
      )
    }
  }

  /**
   * 统一序列化 worker 内部异常
   * delivery 与重试日志复用同一错误文本，避免出现多套截断与展示口径
   */
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

  /**
   * 延迟获取聊天服务，避免 outbox 与 chat 模块在 Nest 注入图里形成强耦合。
   */
  private getMessageChatService() {
    if (!this.messageChatService) {
      this.messageChatService = this.moduleRef.get<MessageChatService>(
        MESSAGE_CHAT_SERVICE_TOKEN,
        { strict: false },
      )
    }

    if (!this.messageChatService) {
      throw new Error('MessageChatService is unavailable')
    }

    return this.messageChatService
  }
}
