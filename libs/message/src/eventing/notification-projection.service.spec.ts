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
    idempotencyKey: 'comment-replied:101:receiver:7',
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
    appendInsertRows?: Array<Record<string, unknown>>
    upsertRows?: Array<Record<string, unknown>>
  }) {
    const appendInsertReturningMock = jest.fn().mockResolvedValue(
      overrides?.appendInsertRows ?? [
        {
          id: 101,
          receiverUserId: 7,
          categoryKey: 'comment_reply',
          projectionKey: 'comment-replied:101:receiver:7',
        },
      ],
    )
    const appendOnConflictDoNothingMock = jest.fn(() => ({
      returning: appendInsertReturningMock,
    }))
    const upsertReturningMock = jest.fn().mockResolvedValue(
      overrides?.upsertRows ?? [
        {
          id: 101,
          receiverUserId: 7,
          categoryKey: 'comment_reply',
          projectionKey: 'comment-replied:101:receiver:7',
        },
      ],
    )
    const upsertOnConflictDoUpdateMock = jest.fn(() => ({
      returning: upsertReturningMock,
    }))
    const insertValuesMock = jest.fn(() => ({
      onConflictDoNothing: appendOnConflictDoNothingMock,
      onConflictDoUpdate: upsertOnConflictDoUpdateMock,
    }))
    const insertMock = jest.fn(() => ({
      values: insertValuesMock,
    }))
    const updateReturningMock = jest.fn().mockResolvedValue([
      {
        id: 101,
        receiverUserId: 7,
        categoryKey: 'comment_reply',
        projectionKey: 'comment-replied:101:receiver:7',
      },
    ])

    const drizzle = {
      db: {
        insert: insertMock,
        delete: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([]),
          })),
        })),
        update: jest.fn(() => ({
          set: jest.fn(() => ({
            where: jest.fn(() => ({
              returning: updateReturningMock,
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
      appendOnConflictDoNothingMock,
      upsertOnConflictDoUpdateMock,
    }
  }

  it('append 模式命中唯一键冲突时会按幂等成功返回已有通知', async () => {
    const existingNotification = {
      id: 99,
      receiverUserId: 7,
      categoryKey: 'comment_reply',
      projectionKey: 'comment-replied:101:receiver:7',
      isRead: false,
    }
    const {
      service,
      drizzle,
      insertValuesMock,
      appendOnConflictDoNothingMock,
    } = createService({
      existing: existingNotification,
      appendInsertRows: [],
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

    expect(insertValuesMock).toHaveBeenCalledTimes(1)
    expect(appendOnConflictDoNothingMock).toHaveBeenCalledTimes(1)
    expect(drizzle.db.query.userNotification.findFirst).toHaveBeenCalledTimes(1)
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

  it('upsert 模式会直接走数据库原子 upsert，不再先查后改', async () => {
    const { service, drizzle, insertValuesMock, upsertOnConflictDoUpdateMock } =
      createService()

    const result = await service.applyCommand(
      {
        mode: 'upsert',
        receiverUserId: 7,
        categoryKey: 'comment_reply',
        projectionKey: 'comment-replied:101:receiver:7',
        mandatory: true,
        title: '有人回复了你的评论',
        content: '回复内容',
      },
      event,
      dispatch,
    )

    expect(insertValuesMock).toHaveBeenCalledTimes(1)
    expect(upsertOnConflictDoUpdateMock).toHaveBeenCalledTimes(1)
    expect(drizzle.db.query.userNotification.findFirst).not.toHaveBeenCalled()
    expect(result).toEqual(
      expect.objectContaining({
        action: 'upsert',
        receiverUserId: 7,
        projectionKey: 'comment-replied:101:receiver:7',
      }),
    )
  })
})
