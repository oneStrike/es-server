import type { DrizzleService } from '@db/core'
import {
  DomainEventConsumerEnum,
  DomainEventDispatchStatusEnum,
} from './eventing.constant'
import { DomainEventDispatchService } from './domain-event-dispatch.service'

function createDrizzleStub() {
  const dispatchRows = [
    {
      id: 11n,
      eventId: 21n,
      consumer: DomainEventConsumerEnum.NOTIFICATION,
      status: DomainEventDispatchStatusEnum.PENDING,
      retryCount: 0,
      nextRetryAt: null,
      lastError: null,
      processedAt: null,
      createdAt: new Date('2026-04-18T00:00:00.000Z'),
      updatedAt: new Date('2026-04-18T00:00:00.000Z'),
    },
  ]
  const claimedRows = [
    {
      ...dispatchRows[0],
      status: DomainEventDispatchStatusEnum.PROCESSING,
      nextRetryAt: new Date('2026-04-18T00:02:00.000Z'),
    },
  ]
  const eventRows = [
    {
      id: 21n,
      eventKey: 'comment.liked',
      domain: 'message',
      idempotencyKey: 'k',
      subjectType: 'user',
      subjectId: 1,
      targetType: 'comment',
      targetId: 9,
      operatorId: 2,
      occurredAt: new Date('2026-04-18T00:00:00.000Z'),
      context: {
        projectionKey: 'notify:1',
      },
      createdAt: new Date('2026-04-18T00:00:00.000Z'),
    },
  ]

  const selectBuilder = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(dispatchRows),
  }
  const updateBuilder = {
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue(claimedRows),
  }

  const drizzle = {
    db: {
      select: jest.fn().mockReturnValue(selectBuilder),
      update: jest.fn().mockReturnValue(updateBuilder),
      query: {
        domainEvent: {
          findMany: jest.fn().mockResolvedValue(eventRows),
        },
      },
    },
    schema: {
      domainEvent: {},
      domainEventDispatch: {
        id: 'id',
        eventId: 'eventId',
        consumer: 'consumer',
        status: 'status',
        nextRetryAt: 'nextRetryAt',
      },
    },
  } as unknown as DrizzleService

  return {
    drizzle,
    selectBuilder,
    updateBuilder,
    dispatchRows,
    claimedRows,
    eventRows,
  }
}

describe('DomainEventDispatchService', () => {
  it('claims a batch and hydrates events with a single findMany call', async () => {
    const { drizzle } = createDrizzleStub()
    const service = new DomainEventDispatchService(drizzle)

    const result = await service.claimPendingDispatchBatch([
      DomainEventConsumerEnum.NOTIFICATION,
    ])

    expect(result).toHaveLength(1)
    expect(result[0]?.dispatch.id).toBe(11n)
    expect(result[0]?.event.id).toBe(21n)
    expect(drizzle.db.query.domainEvent.findMany).toHaveBeenCalledTimes(1)
    expect(drizzle.db.update).toHaveBeenCalledTimes(1)
  })
})
