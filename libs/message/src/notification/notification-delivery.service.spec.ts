import {
  MessageNotificationDispatchStatusEnum,
  MessageNotificationTypeEnum,
} from './notification.constant'

jest.mock('@db/core', () => ({
  DrizzleService: class {},
  escapeLikePattern: (value: string) => value,
}))

describe('message notification delivery service', () => {
  it('persists parsed delivery context from outbox event', async () => {
    const { MessageNotificationDeliveryService }
      = await import('./notification-delivery.service')

    const onConflictDoUpdate = jest.fn().mockResolvedValue(undefined)
    const values = jest.fn(() => ({ onConflictDoUpdate }))
    const insert = jest.fn(() => ({ values }))
    const withErrorHandling = jest.fn(async (callback) => callback())
    const attemptAt = new Date('2026-03-28T16:00:00.000Z')

    const service = new MessageNotificationDeliveryService({
      db: { insert },
      schema: {
        notificationDelivery: {
          outboxId: 'outboxId',
        },
      },
      withErrorHandling,
    } as any)

    await expect(
      service.upsertDeliveryForOutboxEvent(
        {
          id: 10001n,
          bizKey: 'comment:reply:1:to:1001',
          eventType: MessageNotificationTypeEnum.COMMENT_REPLY,
          payload: {
            receiverUserId: '1001',
          },
        },
        {
          status: MessageNotificationDispatchStatusEnum.DELIVERED,
          retryCount: 2,
          notificationId: 88,
          lastAttemptAt: attemptAt,
        },
      ),
    ).resolves.toBeUndefined()

    expect(values).toHaveBeenCalledWith({
      outboxId: 10001n,
      bizKey: 'comment:reply:1:to:1001',
      notificationType: MessageNotificationTypeEnum.COMMENT_REPLY,
      receiverUserId: 1001,
      notificationId: 88,
      status: MessageNotificationDispatchStatusEnum.DELIVERED,
      retryCount: 2,
      failureReason: null,
      lastAttemptAt: attemptAt,
    })
    expect(onConflictDoUpdate).toHaveBeenCalledWith({
      target: 'outboxId',
      set: {
        bizKey: 'comment:reply:1:to:1001',
        notificationType: MessageNotificationTypeEnum.COMMENT_REPLY,
        receiverUserId: 1001,
        notificationId: 88,
        status: MessageNotificationDispatchStatusEnum.DELIVERED,
        retryCount: 2,
        failureReason: null,
        lastAttemptAt: attemptAt,
        updatedAt: attemptAt,
      },
    })
    expect(withErrorHandling).toHaveBeenCalledTimes(1)
  })

  it('maps delivery page items to api-friendly view fields', async () => {
    const { MessageNotificationDeliveryService }
      = await import('./notification-delivery.service')

    const findPagination = jest.fn().mockResolvedValue({
      list: [
        {
          id: 7,
          outboxId: 10001n,
          bizKey: 'comment:reply:1:to:1001',
          notificationType: MessageNotificationTypeEnum.COMMENT_REPLY,
          receiverUserId: 1001,
          notificationId: 88,
          status: MessageNotificationDispatchStatusEnum.FAILED,
          retryCount: 3,
          failureReason: 'payload missing title',
          lastAttemptAt: new Date('2026-03-28T16:01:00.000Z'),
          createdAt: new Date('2026-03-28T16:00:00.000Z'),
          updatedAt: new Date('2026-03-28T16:01:30.000Z'),
        },
      ],
      total: 1,
      pageIndex: 1,
      pageSize: 15,
    })

    const service = new MessageNotificationDeliveryService({
      ext: { findPagination },
      schema: { notificationDelivery: {} },
      db: {},
    } as any)

    await expect(
      service.getNotificationDeliveryPage({
        pageIndex: 1,
        pageSize: 15,
      }),
    ).resolves.toEqual({
      list: [
        expect.objectContaining({
          id: 7,
          outboxId: '10001',
          notificationTypeLabel: '评论回复通知',
          status: MessageNotificationDispatchStatusEnum.FAILED,
          statusLabel: '投递失败',
        }),
      ],
      total: 1,
      pageIndex: 1,
      pageSize: 15,
    })
    expect(findPagination).toHaveBeenCalledTimes(1)
  })

  it('returns empty page when outbox id is not a valid bigint', async () => {
    const { MessageNotificationDeliveryService }
      = await import('./notification-delivery.service')

    const findPagination = jest.fn()
    const service = new MessageNotificationDeliveryService({
      ext: { findPagination },
      schema: { notificationDelivery: {} },
      db: {},
    } as any)

    await expect(
      service.getNotificationDeliveryPage({
        outboxId: 'not-a-bigint',
      }),
    ).resolves.toEqual({
      list: [],
      total: 0,
      pageIndex: 1,
      pageSize: 15,
    })
    expect(findPagination).not.toHaveBeenCalled()
  })
})
