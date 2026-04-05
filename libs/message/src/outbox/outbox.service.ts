import type { Db } from '@db/core'
import type {
  CreateChatMessageCreatedOutboxEventDto,
  CreateMessageOutboxEventDto,
  CreateNotificationOutboxEventDto,
} from './dto/outbox-event.dto'
import { DrizzleService } from '@db/core'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { ChatOutboxEventTypeEnum } from '../chat/chat.constant'
import {
  MessageOutboxDomainEnum,
  MessageOutboxStatusEnum,
} from './outbox.constant'

/**
 * 消息发件箱服务。
 * 统一负责各业务域 outbox 事件入队、通知事件规范化以及补偿重试所需的状态切换。
 */
@Injectable()
export class MessageOutboxService {
  constructor(private readonly drizzle: DrizzleService) {}

  /** 统一复用当前模块的 Drizzle 数据库实例。 */
  private get db() {
    return this.drizzle.db
  }

  /** message_outbox 表访问入口。 */
  private get outbox() {
    return this.drizzle.schema.messageOutbox
  }

  /**
   * 将消息事件入队
   * @param dto 消息事件数据
   */
  async enqueueEvent(dto: CreateMessageOutboxEventDto) {
    return this.drizzle.withErrorHandling(async () =>
      this.enqueueEventInTx(this.db, dto),
    )
  }

  /**
   * 批量将消息事件入队
   * @param dtos 消息事件数据列表
   */
  async enqueueEvents(dtos: CreateMessageOutboxEventDto[]) {
    if (dtos.length === 0) {
      return
    }
    await this.drizzle.withErrorHandling(async () =>
      this.enqueueEventsInTx(this.db, dtos),
    )
  }

  /**
   * 在既有事务中写入单条 outbox 事件。
   * 使用 bizKey 做幂等去重，允许业务写路径安全重试而不会重复插入同一事件。
   */
  async enqueueEventInTx(tx: Db, dto: CreateMessageOutboxEventDto) {
    await tx
      .insert(this.outbox)
      .values({
        domain: dto.domain,
        eventType: dto.eventType,
        bizKey: dto.bizKey,
        payload: dto.payload,
        status: MessageOutboxStatusEnum.PENDING,
      })
      .onConflictDoNothing({
        target: this.outbox.bizKey,
      })
  }

  /**
   * 批量将消息事件入队（事务内）
   * @param tx 事务实例
   * @param dtos 消息事件数据列表
   */
  async enqueueEventsInTx(tx: Db, dtos: CreateMessageOutboxEventDto[]) {
    if (dtos.length === 0) {
      return
    }

    await tx
      .insert(this.outbox)
      .values(
        dtos.map((dto) => ({
          domain: dto.domain,
          eventType: dto.eventType,
          bizKey: dto.bizKey,
          payload: dto.payload,
          status: MessageOutboxStatusEnum.PENDING,
        })),
      )
      .onConflictDoNothing({
        target: this.outbox.bizKey,
      })
  }

  /**
   * 将通知事件入队
   * @param dto 通知事件数据
   */
  async enqueueNotificationEvent(dto: CreateNotificationOutboxEventDto) {
    await this.drizzle.withErrorHandling(async () =>
      this.enqueueNotificationEventInTx(this.db, dto),
    )
  }

  /**
   * 批量将通知事件入队
   * @param dtos 通知事件数据列表
   */
  async enqueueNotificationEvents(dtos: CreateNotificationOutboxEventDto[]) {
    if (dtos.length === 0) {
      return
    }
    await this.drizzle.withErrorHandling(async () =>
      this.enqueueNotificationEventsInTx(this.db, dtos),
    )
  }

  /**
   * 在既有事务中写入单条通知 outbox 事件。
   * 事件类型以 payload.type 为最终事实源，兼容期仍会校验传入 eventType 是否一致。
   */
  async enqueueNotificationEventInTx(
    tx: Db,
    dto: CreateNotificationOutboxEventDto,
  ) {
    const eventType = this.normalizeNotificationEventType(dto)
    await this.enqueueEventInTx(
      tx,
      {
        domain: MessageOutboxDomainEnum.NOTIFICATION,
        eventType,
        bizKey: dto.bizKey,
        payload: dto.payload,
      },
    )
  }

  /**
   * 批量将通知事件入队（事务内）
   * @param tx 事务实例
   * @param dtos 通知事件数据列表
   */
  async enqueueNotificationEventsInTx(
    tx: Db,
    dtos: CreateNotificationOutboxEventDto[],
  ) {
    if (dtos.length === 0) {
      return
    }

    await this.enqueueEventsInTx(
      tx,
      dtos.map((dto) => ({
        domain: MessageOutboxDomainEnum.NOTIFICATION,
        eventType: this.normalizeNotificationEventType(dto),
        bizKey: dto.bizKey,
        payload: dto.payload,
      })),
    )
  }

  /**
   * 将 CHAT 域“消息已创建”事件入队（事务内）。
   * - 只写最小 payload，消费时回读 chat 事实表，避免把过时未读数快照固化进 outbox
   */
  async enqueueChatMessageCreatedEventInTx(
    tx: Db,
    dto: CreateChatMessageCreatedOutboxEventDto,
  ) {
    await this.enqueueEventInTx(tx, {
      domain: MessageOutboxDomainEnum.CHAT,
      eventType: dto.eventType ?? ChatOutboxEventTypeEnum.MESSAGE_CREATED,
      bizKey: dto.bizKey,
      payload: dto.payload,
    })
  }

  /**
   * 按业务键尝试标记 outbox 事件为成功。
   * - 只处理仍处于 PENDING 的事件；若 worker 已先消费完成，则直接返回 false
   */
  async markEventSucceededByBizKey(input: {
    bizKey: string
    domain?: MessageOutboxDomainEnum
  }) {
    return this.drizzle.withErrorHandling(async () => {
      const processedAt = new Date()
      const conditions = [
        eq(this.outbox.bizKey, input.bizKey),
        eq(this.outbox.status, MessageOutboxStatusEnum.PENDING),
      ]
      if (input.domain !== undefined) {
        conditions.push(eq(this.outbox.domain, input.domain))
      }

      const result = await this.db
        .update(this.outbox)
        .set({
          status: MessageOutboxStatusEnum.SUCCESS,
          processedAt,
          nextRetryAt: null,
          lastError: null,
        })
        .where(and(...conditions))

      return (result.rowCount ?? 0) > 0
    })
  }

  /**
   * 按业务键重置失败 outbox 事件，供人工补偿重新投递。
   * 仅允许将 FAILED 事件重置回 PENDING，避免无意回放已成功事件。
   */
  async retryFailedEventByBizKey(input: {
    bizKey: string
    domain?: MessageOutboxDomainEnum
  }) {
    return this.drizzle.withErrorHandling(async () => {
      const conditions = [
        eq(this.outbox.bizKey, input.bizKey),
        eq(this.outbox.status, MessageOutboxStatusEnum.FAILED),
      ]
      if (input.domain !== undefined) {
        conditions.push(eq(this.outbox.domain, input.domain))
      }

      const result = await this.db
        .update(this.outbox)
        .set({
          status: MessageOutboxStatusEnum.PENDING,
          retryCount: 0,
          nextRetryAt: null,
          processedAt: null,
          lastError: null,
        })
        .where(and(...conditions))

      return (result.rowCount ?? 0) > 0
    })
  }

  /**
   * 归一化通知事件类型
   * 兼容期允许调用方保留 eventType，但必须与 payload.type 保持一致
   */
  private normalizeNotificationEventType(
    dto: CreateNotificationOutboxEventDto,
  ) {
    const eventType = dto.payload.type

    if (dto.eventType !== undefined && dto.eventType !== eventType) {
      throw new BadRequestException('通知事件类型与 payload.type 不一致')
    }

    return eventType
  }
}
