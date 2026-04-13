import type {
  DomainEventDispatchRecord,
  DomainEventRecord,
} from '@libs/platform/modules/eventing'
import { MessageNotificationDispatchStatusEnum } from './notification.constant'
import { MessageNotificationDeliveryService } from './notification-delivery.service'

describe('MessageNotificationDeliveryService', () => {
  it('失败投递记录会回填事件定义里的 categoryKey', async () => {
    const onConflictDoUpdate = jest.fn().mockResolvedValue(undefined)
    const values = jest.fn(() => ({
      onConflictDoUpdate,
    }))
    const insert = jest.fn(() => ({
      values,
    }))
    const drizzle = {
      db: {
        insert,
      },
      schema: {
        notificationDelivery: {
          dispatchId: 'dispatchId',
        },
      },
      withErrorHandling: jest.fn(async (fn: () => Promise<unknown>) => fn()),
    }
    const service = new MessageNotificationDeliveryService(drizzle as never)

    const event = {
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
    } satisfies DomainEventRecord
    const dispatch = {
      id: 21n,
      eventId: 11n,
      consumer: 'notification',
      status: 'processing',
      retryCount: 0,
      nextRetryAt: null,
      lastError: null,
      processedAt: null,
      createdAt: new Date('2026-04-13T00:00:00.000Z'),
      updatedAt: new Date('2026-04-13T00:00:00.000Z'),
    } satisfies DomainEventDispatchRecord

    await service.recordFailedDispatch(event, dispatch, {
      status: MessageNotificationDispatchStatusEnum.RETRYING,
      failureReason: 'boom',
    })

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryKey: 'comment_reply',
      }),
    )
  })
})
