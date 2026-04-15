import type {
  DomainEventDispatchRecord,
  DomainEventRecord,
} from '@libs/platform/modules/eventing'
import { DomainEventDispatchStatusEnum } from '@libs/platform/modules/eventing'
import { MessageNotificationDeliveryService } from './notification-delivery.service'
import { MessageNotificationDispatchStatusEnum } from './notification.constant'

describe('messageNotificationDeliveryService', () => {
  it('uses numeric dispatch status enums', async () => {
    const { MessageNotificationDispatchStatusEnum } =
      await import('./notification.constant')

    expect(MessageNotificationDispatchStatusEnum.DELIVERED).toBe(1)
    expect(MessageNotificationDispatchStatusEnum.FAILED).toBe(2)
    expect(MessageNotificationDispatchStatusEnum.RETRYING).toBe(3)
    expect(MessageNotificationDispatchStatusEnum.SKIPPED_PREFERENCE).toBe(4)
  })

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
      idempotencyKey: 'comment-replied:101:receiver:7',
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
      status: DomainEventDispatchStatusEnum.PROCESSING,
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
