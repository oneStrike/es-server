import { DomainEventDispatchService } from './domain-event-dispatch.service'
import {
  DomainEventConsumerEnum,
  DomainEventDispatchStatusEnum,
} from './eventing.constant'

describe('DomainEventDispatchService', () => {
  it('uses numeric dispatch status enums', () => {
    expect(DomainEventDispatchStatusEnum.PENDING).toBe(0)
    expect(DomainEventDispatchStatusEnum.PROCESSING).toBe(1)
    expect(DomainEventDispatchStatusEnum.SUCCESS).toBe(2)
    expect(DomainEventDispatchStatusEnum.FAILED).toBe(3)
  })

  let service: DomainEventDispatchService
  let drizzle: any
  beforeEach(() => {
    const updateReturningMock = jest.fn().mockResolvedValue([
      {
        id: 21n,
        eventId: 11n,
        consumer: DomainEventConsumerEnum.NOTIFICATION,
        status: DomainEventDispatchStatusEnum.PROCESSING,
        retryCount: 0,
        nextRetryAt: new Date('2026-04-13T00:02:00.000Z'),
        lastError: null,
        processedAt: null,
        createdAt: new Date('2026-04-13T00:00:00.000Z'),
        updatedAt: new Date('2026-04-13T00:00:00.000Z'),
      },
    ])
    const updateWhereMock = jest.fn().mockReturnValue({
      rowCount: 1,
      returning: updateReturningMock,
    })
    drizzle = {
      db: {
        update: jest.fn(() => ({
          set: jest.fn(() => ({
            where: updateWhereMock,
          })),
        })),
        select: jest.fn(() => ({
          from: jest.fn(() => ({
            where: jest.fn().mockResolvedValue([]),
            orderBy: jest.fn(() => ({
              limit: jest.fn().mockResolvedValue([]),
            })),
          })),
        })),
      },
      schema: {
        domainEvent: {},
        domainEventDispatch: {},
      },
      assertAffectedRows: jest.fn(),
    }

    service = new DomainEventDispatchService(drizzle)
  })

  it('claimPendingDispatchByEvent 会把 dispatch 抢占为 processing', async () => {
    const result = await service.claimPendingDispatchByEvent(
      11n,
      DomainEventConsumerEnum.NOTIFICATION,
    )

    expect(result).toEqual(
      expect.objectContaining({
        id: 21n,
        status: DomainEventDispatchStatusEnum.PROCESSING,
      }),
    )
  })

  it('retryFailedDispatch 会把失败 dispatch 重置为 pending', async () => {
    const result = await service.retryFailedDispatch(
      21n,
      DomainEventConsumerEnum.NOTIFICATION,
    )

    expect(result).toBe(true)
  })
})
