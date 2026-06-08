import type { DrizzleService } from '@db/core'
import type { MessageNotificationDeliveryService } from '@libs/message/notification/notification-delivery.service'
import type { DomainEventDispatchService } from '@libs/platform/modules/eventing/domain-event-dispatch.service'
import type { AdminUserService } from '../admin-user/admin-user.service'
import { BadRequestException, Logger } from '@nestjs/common'
import {
  DomainEventConsumerEnum,
  DomainEventDispatchStatusEnum,
} from '@libs/platform/modules/eventing/eventing.constant'
import { MessageNotificationDispatchStatusEnum } from '@libs/message/notification/notification.constant'
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

function createDelivery(overrides: Record<string, unknown> = {}) {
  return {
    id: 10088,
    dispatchId: 90001n,
    eventId: 80001n,
    eventKey: 'comment.replied',
    receiverUserId: 1001,
    projectionKey: 'comment:reply:1:user:1001',
    categoryKey: 'comment_reply',
    status: MessageNotificationDispatchStatusEnum.FAILED,
    failureReason: 'notification consumer failed with a long stack trace',
    ...overrides,
  }
}

function createDispatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 90001n,
    consumer: DomainEventConsumerEnum.NOTIFICATION,
    status: DomainEventDispatchStatusEnum.FAILED,
    ...overrides,
  }
}

function createService(options: {
  delivery?: Record<string, unknown> | null
  dispatch?: Record<string, unknown> | null
  dispatchRows?: Record<string, unknown>[]
  total?: number
} = {}) {
  const whereConditions: unknown[] = []
  const countBuilder: Record<string, jest.Mock> = {}
  countBuilder.from = jest.fn(() => countBuilder)
  countBuilder.leftJoin = jest.fn(() => countBuilder)
  countBuilder.where = jest.fn((condition: unknown) => {
    whereConditions.push(condition)
    return Promise.resolve([{ count: options.total ?? 0 }])
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
  rowBuilder.offset = jest.fn(() => Promise.resolve(options.dispatchRows ?? []))

  const select = jest
    .fn()
    .mockImplementationOnce(() => countBuilder)
    .mockImplementationOnce(() => rowBuilder)
  const retryFailedDispatch = jest.fn().mockResolvedValue(true)
  const notificationDeliveryFindFirst = jest
    .fn()
    .mockResolvedValue(
      options.delivery === null
        ? undefined
        : createDelivery(options.delivery),
    )
  const domainEventDispatchFindFirst = jest
    .fn()
    .mockResolvedValue(
      options.dispatch === null
        ? undefined
        : createDispatch(options.dispatch),
    )
  const isSuperAdmin = jest.fn().mockResolvedValue(undefined)
  const drizzle = {
    db: {
      select,
      query: {
        notificationDelivery: {
          findFirst: notificationDeliveryFindFirst,
        },
        domainEventDispatch: {
          findFirst: domainEventDispatchFindFirst,
        },
      },
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
  const adminUserService = {
    isSuperAdmin,
  }
  const service = new MessageMonitorService(
    drizzle,
    asDependency<MessageNotificationDeliveryService>(
      notificationDeliveryService,
    ),
    asDependency<DomainEventDispatchService>(domainEventDispatchService),
    asDependency<AdminUserService>(adminUserService),
  )

  return {
    service,
    mocks: {
      domainEventDispatchFindFirst,
      isSuperAdmin,
      notificationDeliveryFindFirst,
      retryFailedDispatch,
      whereSql: () =>
        whereConditions
          .map((condition) => dialect.sqlToQuery(condition as never).sql)
          .join('\n'),
    },
  }
}

function createSummaryService() {
  const deliveryRows = [
    {
      status: MessageNotificationDispatchStatusEnum.FAILED,
      count: 2,
    },
    {
      status: MessageNotificationDispatchStatusEnum.RETRYING,
      count: 3,
    },
  ]
  const dispatchRows = [
    {
      status: DomainEventDispatchStatusEnum.FAILED,
      count: 5,
    },
    {
      status: DomainEventDispatchStatusEnum.PENDING,
      count: 7,
    },
    {
      status: DomainEventDispatchStatusEnum.PROCESSING,
      count: 11,
    },
  ]
  const deliveryCountBuilder: Record<string, jest.Mock> = {}
  deliveryCountBuilder.from = jest.fn(() => deliveryCountBuilder)
  deliveryCountBuilder.where = jest.fn(() => deliveryCountBuilder)
  deliveryCountBuilder.groupBy = jest.fn(() => Promise.resolve(deliveryRows))

  const dispatchCountBuilder: Record<string, jest.Mock> = {}
  dispatchCountBuilder.from = jest.fn(() => dispatchCountBuilder)
  dispatchCountBuilder.where = jest.fn(() => dispatchCountBuilder)
  dispatchCountBuilder.groupBy = jest.fn(() => Promise.resolve(dispatchRows))

  const select = jest
    .fn()
    .mockImplementationOnce(() => deliveryCountBuilder)
    .mockImplementationOnce(() => dispatchCountBuilder)
  const drizzle = {
    db: { select },
    schema: {
      domainEvent,
      domainEventDispatch,
      messageWsMetric,
      notificationDelivery,
    },
  } as unknown as DrizzleService
  const service = new MessageMonitorService(
    drizzle,
    asDependency<MessageNotificationDeliveryService>({
      getNotificationDeliveryPage: jest.fn(),
    }),
    asDependency<DomainEventDispatchService>({
      retryFailedDispatch: jest.fn(),
    }),
    asDependency<AdminUserService>({ isSuperAdmin: jest.fn() }),
  )

  return {
    service,
    mocks: {
      deliveryCountBuilder,
      dispatchCountBuilder,
      select,
    },
  }
}

function createWsSummaryService(
  aggregate: Record<string, unknown> = {
    requestCount: 100,
    ackSuccessCount: 90,
    ackErrorCount: 10,
    ackLatencyTotalMs: 500n,
    reconnectCount: 3,
    resyncTriggerCount: 4,
    resyncSuccessCount: 2,
    fanoutSkippedCount: 0,
    fanoutPublishErrorCount: 0,
  },
) {
  const aggregateBuilder: Record<string, jest.Mock> = {}
  aggregateBuilder.from = jest.fn(() => aggregateBuilder)
  aggregateBuilder.where = jest.fn(() => Promise.resolve([aggregate]))

  const select = jest.fn(() => aggregateBuilder)
  const drizzle = {
    db: { select },
    schema: {
      domainEvent,
      domainEventDispatch,
      messageWsMetric,
      notificationDelivery,
    },
  } as unknown as DrizzleService
  const service = new MessageMonitorService(
    drizzle,
    asDependency<MessageNotificationDeliveryService>({
      getNotificationDeliveryPage: jest.fn(),
    }),
    asDependency<DomainEventDispatchService>({
      retryFailedDispatch: jest.fn(),
    }),
    asDependency<AdminUserService>({ isSuperAdmin: jest.fn() }),
  )

  return {
    service,
    mocks: {
      aggregateBuilder,
      select,
    },
  }
}

describe('MessageMonitorService', () => {
  it('summarizes monitor counts with grouped queries instead of page totals', async () => {
    const { service, mocks } = createSummaryService()

    await expect(service.getMonitorSummary()).resolves.toMatchObject({
      failedDeliveryCount: 2,
      retryingDeliveryCount: 3,
      failedDispatchCount: 5,
      retryingDispatchCount: 18,
    })
    expect(mocks.select).toHaveBeenCalledTimes(2)
    expect(mocks.deliveryCountBuilder.groupBy).toHaveBeenCalledWith(
      notificationDelivery.status,
    )
    expect(mocks.dispatchCountBuilder.groupBy).toHaveBeenCalledWith(
      domainEventDispatch.status,
    )
  })

  it('applies dispatchStatus=0 as a real filter', async () => {
    const { service, mocks } = createService()

    await service.getNotificationDispatchPage({
      categoryKey: 'comment_reply',
      dispatchStatus: 0,
      pageIndex: 1,
      pageSize: 15,
    })

    expect(mocks.whereSql()).toContain('"domain_event_dispatch"."status"')
    expect(mocks.whereSql()).toContain('"notification_delivery"."category_key"')
  })

  it('maps dispatch monitor event labels and sanitizes diagnostics', async () => {
    const { service } = createService({
      dispatchRows: [
        {
          dispatchId: 90001n,
          eventId: 80001n,
          consumer: DomainEventConsumerEnum.NOTIFICATION,
          dispatchStatus: DomainEventDispatchStatusEnum.FAILED,
          retryCount: 1,
          lastError: 'line 1\nline 2',
          nextRetryAt: null,
          processedAt: null,
          eventKey: 'comment.replied',
          domain: 'message',
          categoryKey: 'comment_reply',
          receiverUserId: 1001,
          projectionKey: 'comment:reply:1:user:1001',
          deliveryStatus: MessageNotificationDispatchStatusEnum.FAILED,
        },
      ],
      total: 1,
    })

    const page = await service.getNotificationDispatchPage({
      pageIndex: 1,
      pageSize: 15,
    })

    expect(page.list[0]).toMatchObject({
      dispatchId: '90001',
      eventId: '80001',
      eventKey: 'comment.replied',
      eventLabel: '评论回复',
      lastError: 'line 1 line 2',
    })
  })

  it('surfaces cross-instance fanout risks in websocket monitor summary', async () => {
    const { service } = createWsSummaryService({
      requestCount: 100,
      ackSuccessCount: 90,
      ackErrorCount: 10,
      ackLatencyTotalMs: 500n,
      reconnectCount: 3,
      resyncTriggerCount: 4,
      resyncSuccessCount: 2,
      fanoutSkippedCount: 1,
      fanoutPublishErrorCount: 2,
    })

    await expect(service.getWsMonitorSummary({ windowHours: 24 })).resolves
      .toMatchObject({
        fanoutSkippedCount: 1,
        fanoutPublishErrorCount: 2,
        realtimeDeploymentRisk: true,
        realtimeDeploymentConstraint: expect.stringContaining('载荷过大跳过'),
      })
  })

  it('rejects invalid retry deliveryId before calling retry service', async () => {
    const { service, mocks } = createService()

    await expect(
      service.retryNotificationDelivery(1, {
        deliveryId: 'abc',
        reason: '人工确认需要重试',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(mocks.retryFailedDispatch).not.toHaveBeenCalled()
  })

  it('requires a failed delivery record before retrying', async () => {
    const { service, mocks } = createService({
      delivery: {
        status: MessageNotificationDispatchStatusEnum.DELIVERED,
      },
    })

    await expect(
      service.retryNotificationDelivery(1, {
        deliveryId: '10088',
        reason: '人工确认需要重试',
      }),
    ).rejects.toThrow('只有投递失败的通知可以重试')
    expect(mocks.retryFailedDispatch).not.toHaveBeenCalled()
  })

  it('requires the delivery to be linked to a notification dispatch', async () => {
    const { service, mocks } = createService({
      dispatch: {
        consumer: DomainEventConsumerEnum.CHAT_REALTIME,
      },
    })

    await expect(
      service.retryNotificationDelivery(1, {
        deliveryId: '10088',
        reason: '人工确认需要重试',
      }),
    ).rejects.toThrow('投递记录未关联通知发送任务')
    expect(mocks.retryFailedDispatch).not.toHaveBeenCalled()
  })

  it('retries a failed delivery by deliveryId and records an operator audit log', async () => {
    const { service, mocks } = createService()
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined)

    await expect(
      service.retryNotificationDelivery(1, {
        deliveryId: '10088',
        reason: '人工确认需要重试',
      }),
    ).resolves.toBe(true)

    expect(mocks.isSuperAdmin).toHaveBeenCalledWith(1)
    expect(mocks.retryFailedDispatch).toHaveBeenCalledWith(
      90001n,
      DomainEventConsumerEnum.NOTIFICATION,
    )
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('notification_delivery_retry'),
    )
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('deliveryId=10088'),
    )
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('reason=人工确认需要重试'),
    )

    warnSpy.mockRestore()
  })

  it('logs and rethrows unexpected retry errors', async () => {
    const { service, mocks } = createService()
    const error = new Error('retry failed')
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined)
    mocks.retryFailedDispatch.mockRejectedValueOnce(error)

    await expect(
      service.retryNotificationDelivery(1, {
        deliveryId: '10088',
        reason: '人工确认需要重试',
      }),
    ).rejects.toThrow(error)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('delivery 10088'),
    )
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(DomainEventConsumerEnum.NOTIFICATION),
    )
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('retry failed'),
    )

    warnSpy.mockRestore()
  })
})
