import type { Prisma } from '@libs/platform/database'
import type {
  CreateMessageOutboxEventDto,
  CreateNotificationOutboxEventDto,
} from './dto/outbox-event.dto'
import { messageOutbox } from '@db/schema'
import { PlatformService } from '@libs/platform/database'
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
export class MessageOutboxService extends PlatformService {
  /**
   * 将消息事件入队
   * @param dto 消息事件数据
   * @param tx 可选的事务对象
   */
  async enqueueEvent(
    dto: CreateMessageOutboxEventDto,
    tx?: any,
  ) {
    try {
      if (tx?.insert) {
        await tx.insert(messageOutbox).values({
          domain: dto.domain,
          eventType: dto.eventType,
          bizKey: dto.bizKey,
          payload: dto.payload,
          status: MessageOutboxStatusEnum.PENDING,
        })
        return
      }

      await this.prisma.messageOutbox.create({
        data: {
          domain: dto.domain,
          eventType: dto.eventType,
          bizKey: dto.bizKey,
          payload: dto.payload,
          status: MessageOutboxStatusEnum.PENDING,
        },
      })
    } catch (error) {
      if ((error)?.code === '23505') {
        return
      }
      this.handlePrismaError(error, {
        P2002: () => undefined,
      })
    }
  }

  /**
   * 将通知事件入队
   * @param dto 通知事件数据
   * @param tx 可选的事务对象
   */
  async enqueueNotificationEvent(
    dto: CreateNotificationOutboxEventDto,
    tx?: any,
  ) {
    await this.enqueueEvent(
      {
        domain: MessageOutboxDomainEnum.NOTIFICATION,
        eventType: dto.eventType,
        bizKey: dto.bizKey,
        payload: dto.payload as unknown as Prisma.InputJsonValue,
      },
      tx,
    )
  }
}
