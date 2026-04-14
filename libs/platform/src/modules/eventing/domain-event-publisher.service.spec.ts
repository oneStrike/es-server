import {
  DomainEventConsumerEnum,
  DomainEventDispatchStatusEnum,
} from './eventing.constant'
import { DomainEventPublisher } from './domain-event-publisher.service'

describe('DomainEventPublisher', () => {
  let service: DomainEventPublisher
  let drizzle: any
  let insertDispatchValuesMock: jest.Mock
  let insertEventValuesMock: jest.Mock

  beforeEach(() => {
    const insertEventReturningMock = jest.fn().mockResolvedValue([
      {
        id: 11n,
        eventKey: 'comment.replied',
        domain: 'message',
        subjectType: 'user',
        subjectId: 9,
        targetType: 'comment',
        targetId: 101,
        operatorId: 9,
        occurredAt: new Date('2026-04-13T00:00:00.000Z'),
        context: { replyCommentId: 101 },
        createdAt: new Date('2026-04-13T00:00:00.000Z'),
      },
    ])
    const insertDispatchReturningMock = jest.fn().mockResolvedValue([
      {
        id: 21n,
        eventId: 11n,
        consumer: DomainEventConsumerEnum.NOTIFICATION,
        status: DomainEventDispatchStatusEnum.PENDING,
        retryCount: 0,
        nextRetryAt: null,
        lastError: null,
        processedAt: null,
        createdAt: new Date('2026-04-13T00:00:00.000Z'),
        updatedAt: new Date('2026-04-13T00:00:00.000Z'),
      },
      {
        id: 22n,
        eventId: 11n,
        consumer: DomainEventConsumerEnum.CHAT_REALTIME,
        status: DomainEventDispatchStatusEnum.PENDING,
        retryCount: 0,
        nextRetryAt: null,
        lastError: null,
        processedAt: null,
        createdAt: new Date('2026-04-13T00:00:00.000Z'),
        updatedAt: new Date('2026-04-13T00:00:00.000Z'),
      },
    ])
    insertDispatchValuesMock = jest.fn(() => ({
      returning: insertDispatchReturningMock,
    }))

    insertEventValuesMock = jest.fn(() => ({
      returning: insertEventReturningMock,
    }))

    drizzle = {
      schema: {
        domainEvent: {},
        domainEventDispatch: {},
      },
      db: {
        insert: jest
          .fn()
          .mockImplementationOnce(() => ({
            values: insertEventValuesMock,
          }))
          .mockImplementationOnce(() => ({
            values: insertDispatchValuesMock,
          })),
      },
      withTransaction: jest.fn(async (fn: (tx: any) => Promise<unknown>) =>
        fn({
          insert: drizzle.db.insert,
        }),
      ),
    }

    service = new DomainEventPublisher(drizzle)
  })

  it('会在同一事务内写入 domain_event 和对应的 dispatch 记录', async () => {
    await service.publish({
      eventKey: 'comment.replied',
      domain: 'message',
      subjectType: 'user',
      subjectId: 9,
      targetType: 'comment',
      targetId: 101,
      operatorId: 9,
      occurredAt: new Date('2026-04-13T00:00:00.000Z'),
      consumers: [
        DomainEventConsumerEnum.NOTIFICATION,
        DomainEventConsumerEnum.CHAT_REALTIME,
      ],
      context: {
        replyCommentId: 101,
      },
    })

    expect(drizzle.withTransaction).toHaveBeenCalledTimes(1)
    expect(insertEventValuesMock).toHaveBeenCalledTimes(1)
    expect(insertDispatchValuesMock).toHaveBeenCalledWith([
      expect.objectContaining({
        eventId: 11n,
        consumer: DomainEventConsumerEnum.NOTIFICATION,
      }),
      expect.objectContaining({
        eventId: 11n,
        consumer: DomainEventConsumerEnum.CHAT_REALTIME,
      }),
    ])
  })
})
