import { DomainEventPublisher } from './domain-event-publisher.service'
import {
  DomainEventConsumerEnum,
  DomainEventDispatchStatusEnum,
} from './eventing.constant'

describe('domainEventPublisher', () => {
  let service: DomainEventPublisher
  let drizzle: any
  let insertDispatchValuesMock: jest.Mock
  let insertEventValuesMock: jest.Mock
  let onConflictDoNothingMock: jest.Mock
  const eventRow = {
    id: 11n,
    eventKey: 'comment.replied',
    domain: 'message',
    idempotencyKey: 'notify:comment:reply:101:receiver:7',
    subjectType: 'user',
    subjectId: 9,
    targetType: 'comment',
    targetId: 101,
    operatorId: 9,
    occurredAt: new Date('2026-04-13T00:00:00.000Z'),
    context: { replyCommentId: 101 },
    createdAt: new Date('2026-04-13T00:00:00.000Z'),
  }
  const dispatchRows = [
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
  ]

  beforeEach(() => {
    const insertEventReturningMock = jest.fn().mockResolvedValue([eventRow])
    const insertDispatchReturningMock = jest
      .fn()
      .mockResolvedValue(dispatchRows)
    insertDispatchValuesMock = jest.fn(() => ({
      returning: insertDispatchReturningMock,
    }))

    insertEventValuesMock = jest.fn(() => ({
      onConflictDoNothing: onConflictDoNothingMock,
    }))
    onConflictDoNothingMock = jest.fn(() => ({
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
    const result = await service.publish({
      eventKey: 'comment.replied',
      domain: 'message',
      idempotencyKey: eventRow.idempotencyKey,
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
    expect(onConflictDoNothingMock).toHaveBeenCalledTimes(1)
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
    expect(result.duplicated).toBe(false)
  })

  it('命中相同 idempotencyKey 时会复用既有 event 和 dispatch', async () => {
    const duplicateInsertReturningMock = jest.fn().mockResolvedValue([])
    const duplicateOnConflictDoNothingMock = jest.fn(() => ({
      returning: duplicateInsertReturningMock,
    }))
    const duplicateInsertEventValuesMock = jest.fn(() => ({
      onConflictDoNothing: duplicateOnConflictDoNothingMock,
    }))
    const selectDomainEventLimitMock = jest.fn().mockResolvedValue([eventRow])
    const selectDomainEventWhereMock = jest.fn(() => ({
      limit: selectDomainEventLimitMock,
    }))
    const selectDispatchWhereMock = jest.fn().mockResolvedValue(dispatchRows)

    const tx = {
      insert: jest.fn(() => ({
        values: duplicateInsertEventValuesMock,
      })),
      select: jest
        .fn()
        .mockImplementationOnce(() => ({
          from: jest.fn(() => ({
            where: selectDomainEventWhereMock,
          })),
        }))
        .mockImplementationOnce(() => ({
          from: jest.fn(() => ({
            where: selectDispatchWhereMock,
          })),
        })),
    }

    const result = await service.publishInTx(tx as never, {
      eventKey: 'comment.replied',
      domain: 'message',
      idempotencyKey: eventRow.idempotencyKey,
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

    expect(duplicateInsertEventValuesMock).toHaveBeenCalledTimes(1)
    expect(duplicateOnConflictDoNothingMock).toHaveBeenCalledTimes(1)
    expect(selectDomainEventWhereMock).toHaveBeenCalledTimes(1)
    expect(selectDispatchWhereMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      duplicated: true,
      event: expect.objectContaining({
        id: 11n,
        idempotencyKey: eventRow.idempotencyKey,
      }),
      dispatches: dispatchRows,
    })
  })
})
