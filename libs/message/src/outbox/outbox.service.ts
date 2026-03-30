import type { Db } from '@db/core'
import type {
  CreateChatMessageCreatedOutboxEventInput,
  CreateMessageOutboxEventInput,
  CreateNotificationOutboxEventInput,
} from './outbox.type'
import { DrizzleService } from '@db/core'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { ChatOutboxEventTypeEnum } from '../chat/chat.constant'
import { MessageNotificationTypeEnum } from '../notification/notification.constant'
import {
  MessageOutboxDomainEnum,
  MessageOutboxStatusEnum,
} from './outbox.constant'

/**
 * 消息发件箱服务
 * 提供消息事件的入队功能，实现发件箱模式
 */
@Injectable()
export class MessageOutboxService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get outbox() {
    return this.drizzle.schema.messageOutbox
  }

  /**
   * 将消息事件入队
   * @param dto 消息事件数据
   */
  async enqueueEvent(dto: CreateMessageOutboxEventInput) {
    return this.drizzle.withErrorHandling(async () =>
      this.enqueueEventInTx(this.db, dto),
    )
  }

  /**
   * 批量将消息事件入队
   * @param dtos 消息事件数据列表
   */
  async enqueueEvents(dtos: CreateMessageOutboxEventInput[]) {
    if (dtos.length === 0) {
      return
    }
    await this.drizzle.withErrorHandling(async () =>
      this.enqueueEventsInTx(this.db, dtos),
    )
  }

  async enqueueEventInTx(tx: Db, dto: CreateMessageOutboxEventInput) {
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
  async enqueueEventsInTx(tx: Db, dtos: CreateMessageOutboxEventInput[]) {
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
  async enqueueNotificationEvent(dto: CreateNotificationOutboxEventInput) {
    await this.drizzle.withErrorHandling(async () =>
      this.enqueueNotificationEventInTx(this.db, dto),
    )
  }

  /**
   * 批量将通知事件入队
   * @param dtos 通知事件数据列表
   */
  async enqueueNotificationEvents(dtos: CreateNotificationOutboxEventInput[]) {
    if (dtos.length === 0) {
      return
    }
    await this.drizzle.withErrorHandling(async () =>
      this.enqueueNotificationEventsInTx(this.db, dtos),
    )
  }

  async enqueueNotificationEventInTx(
    tx: Db,
    dto: CreateNotificationOutboxEventInput,
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
    dtos: CreateNotificationOutboxEventInput[],
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
    dto: CreateChatMessageCreatedOutboxEventInput,
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
   * 归一化通知事件类型
   * 兼容期允许调用方保留 eventType，但必须与 payload.type 保持一致
   */
  private normalizeNotificationEventType(
    dto: CreateNotificationOutboxEventInput,
  ): MessageNotificationTypeEnum {
    const eventType = dto.payload.type

    if (dto.eventType !== undefined && dto.eventType !== eventType) {
      throw new BadRequestException('通知事件类型与 payload.type 不一致')
    }

    return eventType
  }
}
