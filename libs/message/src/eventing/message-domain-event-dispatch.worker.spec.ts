import {
  DomainEventConsumerEnum,
  DomainEventDispatchStatusEnum,
  DOMAIN_EVENT_DISPATCH_MAX_RETRY,
} from '@libs/platform/modules/eventing'
import { MessageNotificationDispatchStatusEnum } from '../notification/notification.constant'
import { MessageDomainEventDispatchWorker } from './message-domain-event-dispatch.worker'

describe('MessageDomainEventDispatchWorker', () => {
  function buildDispatch(retryCount: number) {
    return {
      id: 21n,
      eventId: 11n,
      consumer: DomainEventConsumerEnum.NOTIFICATION,
      status: DomainEventDispatchStatusEnum.PROCESSING,
      retryCount,
      nextRetryAt: null,
      lastError: null,
      processedAt: null,
      createdAt: new Date('2026-04-13T00:00:00.000Z'),
      updatedAt: new Date('2026-04-13T00:00:00.000Z'),
    }
  }

  function buildEvent() {
    return {
      id: 11n,
      eventKey: 'comment.replied',
      domain: 'message',
      subjectType: 'user',
      subjectId: 9,
      targetType: 'comment',
      targetId: 101,
      operatorId: 9,
      occurredAt: new Date('2026-04-13T00:00:00.000Z'),
      context: {
        receiverUserId: 7,
        projectionKey: 'comment-replied:101:receiver:7',
      },
      createdAt: new Date('2026-04-13T00:00:00.000Z'),
    }
  }

  function createWorker(retryCount: number) {
    const domainEventDispatchService = {
      recoverStaleDispatches: jest.fn().mockResolvedValue(undefined),
      claimPendingDispatchBatch: jest.fn().mockResolvedValue([
        {
          event: buildEvent(),
          dispatch: buildDispatch(retryCount),
        },
      ]),
      markDispatchSucceeded: jest.fn().mockResolvedValue(undefined),
      markDispatchFailed: jest.fn().mockResolvedValue(undefined),
    }
    const notificationEventConsumer = {
      consume: jest.fn().mockRejectedValue(new Error('notification-consumer-boom')),
    }
    const chatRealtimeEventConsumer = {
      consume: jest.fn(),
    }
    const notificationDeliveryService = {
      recordFailedDispatch: jest.fn().mockResolvedValue(undefined),
    }

    const worker = new (MessageDomainEventDispatchWorker as any)(
      domainEventDispatchService,
      notificationEventConsumer,
      chatRealtimeEventConsumer,
      notificationDeliveryService,
    )

    return {
      worker,
      domainEventDispatchService,
      notificationEventConsumer,
      notificationDeliveryService,
    }
  }

  it('通知消费失败但仍可重试时，会把 delivery 状态写成 RETRYING', async () => {
    const {
      worker,
      domainEventDispatchService,
      notificationDeliveryService,
    } = createWorker(0)

    await worker.consumePendingDispatches()

    expect(notificationDeliveryService.recordFailedDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ eventKey: 'comment.replied' }),
      expect.objectContaining({ id: 21n, retryCount: 0 }),
      expect.objectContaining({
        status: MessageNotificationDispatchStatusEnum.RETRYING,
      }),
    )
    expect(domainEventDispatchService.markDispatchFailed).toHaveBeenCalled()
  })

  it('通知消费达到最后一次失败时，会把 delivery 状态写成 FAILED', async () => {
    const {
      worker,
      notificationDeliveryService,
    } = createWorker(DOMAIN_EVENT_DISPATCH_MAX_RETRY - 1)

    await worker.consumePendingDispatches()

    expect(notificationDeliveryService.recordFailedDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ eventKey: 'comment.replied' }),
      expect.objectContaining({
        retryCount: DOMAIN_EVENT_DISPATCH_MAX_RETRY - 1,
      }),
      expect.objectContaining({
        status: MessageNotificationDispatchStatusEnum.FAILED,
      }),
    )
  })
})
