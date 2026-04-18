import type { Db, DrizzleService } from '@db/core'
import { DomainEventConsumerEnum } from './eventing.constant'
import { DomainEventPublisher } from './domain-event-publisher.service'

function createPublisherDrizzleStub() {
  const insertedEvents = [
    {
      id: 11n,
      eventKey: 'announcement.published',
      domain: 'message',
      idempotencyKey: 'announcement:notify:1:user:7',
      subjectType: 'system',
      subjectId: 1,
      targetType: 'announcement',
      targetId: 1,
      operatorId: null,
      occurredAt: new Date('2026-04-18T00:00:00.000Z'),
      context: {
        projectionKey: 'announcement:notify:1:user:7',
      },
      createdAt: new Date('2026-04-18T00:00:00.000Z'),
    },
  ]
  const insertedDispatches = [
    {
      id: 21n,
      eventId: 11n,
      consumer: DomainEventConsumerEnum.NOTIFICATION,
      status: 0,
      retryCount: 0,
      nextRetryAt: null,
      lastError: null,
      processedAt: null,
      createdAt: new Date('2026-04-18T00:00:00.000Z'),
      updatedAt: new Date('2026-04-18T00:00:00.000Z'),
    },
  ]

  const eventInsertBuilder = {
    values: jest.fn().mockReturnThis(),
    onConflictDoNothing: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue(insertedEvents),
  }
  const dispatchInsertBuilder = {
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue(insertedDispatches),
  }

  const tx = {
    insert: jest
      .fn()
      .mockReturnValueOnce(eventInsertBuilder)
      .mockReturnValueOnce(dispatchInsertBuilder),
  } as unknown as Db

  const drizzle = {
    withTransaction: jest
      .fn()
      .mockImplementation(async (handler) => handler(tx)),
    schema: {
      domainEvent: {
        domain: 'domain',
        idempotencyKey: 'idempotencyKey',
      },
      domainEventDispatch: {},
    },
  } as unknown as DrizzleService

  return {
    drizzle,
    eventInsertBuilder,
    dispatchInsertBuilder,
  }
}

describe('DomainEventPublisher', () => {
  it('batch publishes by idempotency key and only creates dispatches for inserted events', async () => {
    const { drizzle, eventInsertBuilder, dispatchInsertBuilder } =
      createPublisherDrizzleStub()
    const publisher = new DomainEventPublisher(drizzle)

    const result = await publisher.publishManyByIdempotencyKey([
      {
        eventKey: 'announcement.published',
        domain: 'message',
        idempotencyKey: 'announcement:notify:1:user:7',
        subjectType: 'system',
        subjectId: 1,
        targetType: 'announcement',
        targetId: 1,
        consumers: [DomainEventConsumerEnum.NOTIFICATION],
        context: {
          projectionKey: 'announcement:notify:1:user:7',
        },
      },
      {
        eventKey: 'announcement.published',
        domain: 'message',
        idempotencyKey: 'announcement:notify:1:user:8',
        subjectType: 'system',
        subjectId: 1,
        targetType: 'announcement',
        targetId: 1,
        consumers: [DomainEventConsumerEnum.NOTIFICATION],
        context: {
          projectionKey: 'announcement:notify:1:user:8',
        },
      },
    ])

    expect(result.insertedCount).toBe(1)
    expect(result.duplicatedCount).toBe(1)
    expect(eventInsertBuilder.values).toHaveBeenCalledTimes(1)
    expect(dispatchInsertBuilder.values).toHaveBeenCalledWith([
      expect.objectContaining({
        eventId: 11n,
        consumer: DomainEventConsumerEnum.NOTIFICATION,
      }),
    ])
  })
})
