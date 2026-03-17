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
   * @param tx 可选的事务对象
   */
  async enqueueEvent(
    dto: CreateMessageOutboxEventDto,
    tx?: Db,
  ) {
    const client = tx ?? this.db
    try {
      await client
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
    } catch (error) {
      if (this.drizzle.isUniqueViolation(error)) {
        return
      }
      throw error
    }
  }

  /**
   * 将通知事件入队
   * @param dto 通知事件数据
   * @param tx 可选的事务对象
   */
  async enqueueNotificationEvent(
    dto: CreateNotificationOutboxEventDto,
    tx?: Db,
  ) {
    await this.enqueueEvent(
      {
        domain: MessageOutboxDomainEnum.NOTIFICATION,
        eventType: dto.eventType,
        bizKey: dto.bizKey,
        payload: dto.payload,
      },
      tx,
    )
  }
}
