import type {
  DomainEventDispatchRecord,
  DomainEventRecord,
} from '@libs/platform/modules/eventing'
import { DomainEventDispatchStatusEnum } from '@libs/platform/modules/eventing'
import { NotificationProjectionService } from './notification-projection.service'

describe('notificationProjectionService', () => {
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
    context: {},
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

  function createService(overrides?: {
    existing?: Record<string, unknown> | null
  }) {
    const insertReturningMock = jest.fn().mockResolvedValue([
      {
        id: 101,
        receiverUserId: 7,
        categoryKey: 'comment_reply',
        projectionKey: 'comment-replied:101:receiver:7',
      },
    ])
    const insertValuesMock = jest.fn(() => ({
      returning: insertReturningMock,
    }))

    const drizzle = {
      db: {
        insert: jest.fn(() => ({
          values: insertValuesMock,
        })),
        delete: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([]),
          })),
        })),
        update: jest.fn(() => ({
          set: jest.fn(() => ({
            where: jest.fn(() => ({
              returning: jest.fn().mockResolvedValue([]),
            })),
          })),
        })),
        query: {
          userNotification: {
            findFirst: jest.fn().mockResolvedValue(overrides?.existing ?? null),
          },
        },
      },
      schema: {
        userNotification: {
          id: 'id',
          receiverUserId: 'receiverUserId',
          projectionKey: 'projectionKey',
        },
      },
    }

    const preferenceService = {
      getEffectiveNotificationPreference: jest.fn().mockResolvedValue({
        isEnabled: true,
      }),
    }
    const templateService = {
      renderNotificationTemplate: jest.fn().mockResolvedValue({
        title: '有人回复了你的评论',
        content: '回复内容',
        categoryKey: 'comment_reply',
        usedTemplate: false,
      }),
    }
    const inboxService = {
      getSummary: jest.fn(),
    }

    const service = new NotificationProjectionService(
      drizzle as never,
      preferenceService as never,
      templateService as never,
      inboxService as never,
    )

    return {
      service,
      drizzle,
      insertValuesMock,
    }
  }

  it('append 模式命中相同 projectionKey 时会按幂等成功返回已有通知', async () => {
    const existingNotification = {
      id: 99,
      receiverUserId: 7,
      categoryKey: 'comment_reply',
      projectionKey: 'comment-replied:101:receiver:7',
      isRead: false,
    }
    const { service, drizzle, insertValuesMock } = createService({
      existing: existingNotification,
    })

    const result = await service.applyCommand(
      {
        mode: 'append',
        receiverUserId: 7,
        categoryKey: 'comment_reply',
        projectionKey: 'comment-replied:101:receiver:7',
        mandatory: false,
        title: '有人回复了你的评论',
        content: '回复内容',
      },
      event,
      dispatch,
    )

    expect(drizzle.db.query.userNotification.findFirst).toHaveBeenCalled()
    expect(insertValuesMock).not.toHaveBeenCalled()
    expect(result).toEqual({
      action: 'append',
      receiverUserId: 7,
      projectionKey: 'comment-replied:101:receiver:7',
      notification: existingNotification,
      templateId: undefined,
      usedTemplate: false,
      fallbackReason: 'idempotent_existing',
    })
  })
})
