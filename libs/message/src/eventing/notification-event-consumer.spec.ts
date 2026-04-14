import type { DomainEventDispatchRecord, DomainEventRecord } from '@libs/platform/modules/eventing/domain-event.type'
import { DomainEventDispatchStatusEnum } from '@libs/platform/modules/eventing'
import { NotificationEventConsumer } from './notification-event.consumer'

describe('notificationEventConsumer', () => {
  let service: NotificationEventConsumer
  let projectionService: any
  let deliveryService: any
  let realtimeService: any

  beforeEach(() => {
    projectionService = {
      applyCommand: jest.fn().mockResolvedValue({
        action: 'append',
        notification: {
          id: 101,
          receiverUserId: 7,
          categoryKey: 'comment_reply',
          projectionKey: 'comment-replied:101:receiver:7',
          isRead: false,
        },
      }),
    }
    deliveryService = {
      recordHandledDispatch: jest.fn().mockResolvedValue(undefined),
    }
    realtimeService = {
      emitNotificationCreated: jest.fn(),
      emitNotificationUpdated: jest.fn(),
      emitNotificationDeleted: jest.fn(),
      emitInboxSummaryUpdated: jest.fn(),
    }

    service = new NotificationEventConsumer(
      projectionService,
      deliveryService,
      realtimeService,
    )
  })

  it('会按显式 handler map 把 comment.replied 事件投影为追加通知', async () => {
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
        categoryKey: 'comment_reply',
        mandatory: false,
        title: '有人回复了你的评论',
        content: '回复内容',
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

    await service.consume(event, dispatch)

    expect(projectionService.applyCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'append',
        receiverUserId: 7,
        categoryKey: 'comment_reply',
        projectionKey: 'comment-replied:101:receiver:7',
      }),
      event,
      dispatch,
    )
    expect(realtimeService.emitNotificationCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 101,
        receiverUserId: 7,
      }),
    )
  })
})
