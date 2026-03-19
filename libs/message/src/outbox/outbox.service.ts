import type { Db } from '@db/core'
import type {
  CreateMessageOutboxEventDto,
  CreateNotificationOutboxEventDto,
} from './dto/outbox-event.dto'
import { DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'
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
  async enqueueEvent(dto: CreateMessageOutboxEventDto) {
    return this.drizzle.withErrorHandling(async () =>
      this.enqueueEventInTx(this.db, dto),
    )
  }

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
   * 将通知事件入队
   * @param dto 通知事件数据
   */
  async enqueueNotificationEvent(dto: CreateNotificationOutboxEventDto) {
    await this.drizzle.withErrorHandling(async () =>
      this.enqueueNotificationEventInTx(this.db, dto),
    )
  }

  async enqueueNotificationEventInTx(
    tx: Db,
    dto: CreateNotificationOutboxEventDto,
  ) {
    await this.enqueueEventInTx(
      tx,
      {
        domain: MessageOutboxDomainEnum.NOTIFICATION,
        eventType: dto.eventType,
        bizKey: dto.bizKey,
        payload: dto.payload,
      },
    )
  }
}
