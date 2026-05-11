import type { DrizzleService } from '@db/core'
import type { MessageNotificationDeliveryService } from '@libs/message/notification/notification-delivery.service'
import type { DomainEventDispatchService } from '@libs/platform/modules/eventing/domain-event-dispatch.service'
import { BadRequestException, Logger } from '@nestjs/common'
import { DomainEventConsumerEnum } from '@libs/platform/modules/eventing/eventing.constant'
import { PgDialect } from 'drizzle-orm/pg-core/dialect'
import {
  domainEvent,
  domainEventDispatch,
  messageWsMetric,
  notificationDelivery,
} from '@db/schema'
import { MessageMonitorService } from './message-monitor.service'

const dialect = new PgDialect()

function asDependency<T>(value: unknown = {}) {
  return value as T
}

function createService() {
  const whereConditions: unknown[] = []
  const countBuilder: Record<string, jest.Mock> = {}
  countBuilder.from = jest.fn(() => countBuilder)
  countBuilder.leftJoin = jest.fn(() => countBuilder)
  countBuilder.where = jest.fn((condition: unknown) => {
    whereConditions.push(condition)
    return Promise.resolve([{ count: 0 }])
  })

  const rowBuilder: Record<string, jest.Mock> = {}
  rowBuilder.from = jest.fn(() => rowBuilder)
  rowBuilder.leftJoin = jest.fn(() => rowBuilder)
  rowBuilder.where = jest.fn((condition: unknown) => {
    whereConditions.push(condition)
    return rowBuilder
  })
  rowBuilder.orderBy = jest.fn(() => rowBuilder)
  rowBuilder.limit = jest.fn(() => rowBuilder)
  rowBuilder.offset = jest.fn(() => Promise.resolve([]))

  const select = jest
    .fn()
    .mockImplementationOnce(() => countBuilder)
    .mockImplementationOnce(() => rowBuilder)
  const retryFailedDispatch = jest.fn().mockResolvedValue(true)
  const drizzle = {
    db: {
      select,
    },
    schema: {
      domainEvent,
      domainEventDispatch,
      messageWsMetric,
      notificationDelivery,
    },
  } as unknown as DrizzleService
  const notificationDeliveryService = {
    getNotificationDeliveryPage: jest.fn(),
  }
  const domainEventDispatchService = {
    retryFailedDispatch,
  }
  const service = new MessageMonitorService(
    drizzle,
    asDependency<MessageNotificationDeliveryService>(
      notificationDeliveryService,
    ),
    asDependency<DomainEventDispatchService>(domainEventDispatchService),
  )

  return {
    service,
    mocks: {
      retryFailedDispatch,
      whereSql: () =>
        whereConditions
          .map((condition) => dialect.sqlToQuery(condition as never).sql)
          .join('\n'),
    },
  }
}

describe('MessageMonitorService', () => {
  it('applies dispatchStatus=0 as a real filter', async () => {
    const { service, mocks } = createService()

    await service.getNotificationDispatchPage({
      dispatchStatus: 0,
      pageIndex: 1,
      pageSize: 15,
    })

    expect(mocks.whereSql()).toContain('"domain_event_dispatch"."status"')
  })

  it('rejects invalid retry dispatchId before calling retry service', async () => {
    const { service, mocks } = createService()

    await expect(
      service.retryNotificationDeliveryByDispatchId('abc'),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(mocks.retryFailedDispatch).not.toHaveBeenCalled()
  })

  it('keeps expected retry negative results as false', async () => {
    const { service, mocks } = createService()
    mocks.retryFailedDispatch.mockResolvedValueOnce(false)

    await expect(
      service.retryNotificationDeliveryByDispatchId('10088'),
    ).resolves.toBe(false)
    expect(mocks.retryFailedDispatch).toHaveBeenCalledWith(
      10088n,
      DomainEventConsumerEnum.NOTIFICATION,
    )
  })

  it('logs and rethrows unexpected retry errors', async () => {
    const { service, mocks } = createService()
    const error = new Error('retry failed')
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined)
    mocks.retryFailedDispatch.mockRejectedValueOnce(error)

    await expect(
      service.retryNotificationDeliveryByDispatchId('10088'),
    ).rejects.toThrow(error)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('10088'))
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(DomainEventConsumerEnum.NOTIFICATION),
    )
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('retry failed'),
    )

    warnSpy.mockRestore()
  })
})
