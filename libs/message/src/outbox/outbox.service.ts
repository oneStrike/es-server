import type { Prisma } from '@libs/base/database'
import type {
  CreateMessageOutboxEventDto,
  CreateNotificationOutboxEventDto,
} from './dto/outbox-event.dto'
import { BaseService } from '@libs/base/database'
import { Injectable } from '@nestjs/common'
import {
  MessageOutboxDomainEnum,
  MessageOutboxStatusEnum,
} from './outbox.constant'

@Injectable()
export class MessageOutboxService extends BaseService {
  async enqueueEvent(
    dto: CreateMessageOutboxEventDto,
    tx?: any,
  ) {
    const outbox = tx?.messageOutbox ?? this.prisma.messageOutbox
    try {
      await outbox.create({
        data: {
          domain: dto.domain,
          eventType: dto.eventType,
          bizKey: dto.bizKey,
          payload: dto.payload,
          status: MessageOutboxStatusEnum.PENDING,
        },
      })
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        return
      }
      throw error
    }
  }

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
