import type { Db } from '@db/core'
import type {
  PublishDomainEventInput,
  PublishDomainEventResult,
} from './domain-event.type'
import { DrizzleService } from '@db/core'
import { BadRequestException, Injectable } from '@nestjs/common'
import { DomainEventDispatchStatusEnum } from './eventing.constant'

/**
 * 通用领域事件发布器。
 * 统一负责把领域事实与按 consumer 拆分的 dispatch 记录写入数据库。
 */
@Injectable()
export class DomainEventPublisher {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get domainEvent() {
    return this.drizzle.schema.domainEvent
  }

  private get domainEventDispatch() {
    return this.drizzle.schema.domainEventDispatch
  }

  async publish(input: PublishDomainEventInput): Promise<PublishDomainEventResult> {
    return this.drizzle.withTransaction(async tx => this.publishInTx(tx, input))
  }

  async publishInTx(
    tx: Db,
    input: PublishDomainEventInput,
  ): Promise<PublishDomainEventResult> {
    if (!input.consumers.length) {
      throw new BadRequestException('领域事件至少需要声明一个 consumer')
    }

    const occurredAt = input.occurredAt ?? new Date()
    const insertedEvents = await tx
      .insert(this.domainEvent)
      .values({
        eventKey: input.eventKey,
        domain: input.domain,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        targetType: input.targetType,
        targetId: input.targetId,
        operatorId: input.operatorId,
        occurredAt,
        context: input.context,
      })
      .returning()

    const event = insertedEvents[0]
    if (!event) {
      throw new Error('领域事件写入失败')
    }

    const insertedDispatches = await tx
      .insert(this.domainEventDispatch)
      .values(
        input.consumers.map(consumer => ({
          eventId: event.id,
          consumer,
          status: DomainEventDispatchStatusEnum.PENDING,
        })),
      )
      .returning()

    return {
      event: {
        ...event,
        context:
          event.context && typeof event.context === 'object' && !Array.isArray(event.context)
            ? (event.context as Record<string, unknown>)
            : null,
      },
      dispatches: insertedDispatches,
    }
  }
}
