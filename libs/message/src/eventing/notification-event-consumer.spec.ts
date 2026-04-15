import type { DomainEventDispatchRecord, DomainEventRecord } from '@libs/platform/modules/eventing/domain-event.type'
import { DomainEventDispatchStatusEnum } from '@libs/platform/modules/eventing'
import { NotificationEventConsumer } from './notification-event.consumer'

describe('notificationEventConsumer', () => {
  let service: NotificationEventConsumer
  let drizzle: any
  let projectionService: any
  let deliveryService: any
  let realtimeService: any

  beforeEach(() => {
    drizzle = {
      db: {
        query: {
          appUser: {
            findFirst: jest.fn().mockResolvedValue({
              id: 9,
              nickname: '回复者',
              avatarUrl: 'https://example.com/avatar.png',
            }),
          },
        },
      },
    }
    projectionService = {
      applyCommand: jest.fn().mockResolvedValue({
        action: 'append',
        receiverUserId: 7,
        notification: {
          id: 101,
          receiverUserId: 7,
          actorUserId: 9,
          categoryKey: 'comment_reply',
          projectionKey: 'comment-replied:101:receiver:7',
          title: '有人回复了你的评论',
          content: '回复内容',
          payload: {
            replyCommentId: 101,
          },
          isRead: false,
        },
      }),
      getInboxSummary: jest.fn().mockResolvedValue({
        notificationUnreadCount: 1,
        chatUnreadCount: 0,
        totalUnreadCount: 1,
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
      drizzle,
      projectionService,
      deliveryService,
      realtimeService,
    )
  })

  it('会按显式 handler map 把 comment.replied 事件投影为公开通知并推送实时事件', async () => {
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
        categoryLabel: '评论回复',
        payload: {
          replyCommentId: 101,
        },
        actorUser: {
          id: 9,
          nickname: '回复者',
          avatarUrl: 'https://example.com/avatar.png',
        },
      }),
    )
    expect(realtimeService.emitNotificationCreated).toHaveBeenCalledWith(
      expect.not.objectContaining({
        projectionKey: expect.any(String),
      }),
    )
  })

  it('删除通知时只在拿到通知 ID 后推送 id 载荷，不再依赖 projectionKey', async () => {
    projectionService.applyCommand.mockResolvedValueOnce({
      action: 'delete',
      receiverUserId: 7,
      notification: {
        id: 101,
        receiverUserId: 7,
        actorUserId: null,
      },
    })

    const event = {
      id: 11n,
      eventKey: 'announcement.unpublished',
      domain: 'message',
      subjectType: 'announcement',
      subjectId: 42,
      targetType: 'announcement',
      targetId: 42,
      operatorId: 9,
      occurredAt: new Date('2026-04-13T00:00:00.000Z'),
      context: {
        receiverUserId: 7,
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

    expect(realtimeService.emitNotificationDeleted).toHaveBeenCalledWith(7, {
      id: 101,
    })
  })
})
