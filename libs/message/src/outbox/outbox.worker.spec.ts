import { ChatOutboxEventTypeEnum } from '../chat/chat.constant'
import {
  MessageNotificationDispatchStatusEnum,
  MessageNotificationTypeEnum,
} from '../notification/notification.constant'
import {
  MESSAGE_OUTBOX_MAX_RETRY,
  MessageOutboxDomainEnum,
  MessageOutboxStatusEnum,
} from './outbox.constant'

jest.mock('@db/core', () => ({
  DrizzleService: class {},
}))

describe('message outbox worker', () => {
  it('records delivery result after successful notification consumption', async () => {
    const { MessageOutboxWorker } = await import('./outbox.worker')

    const event = {
      id: 10001n,
      domain: MessageOutboxDomainEnum.NOTIFICATION,
      eventType: MessageNotificationTypeEnum.COMMENT_REPLY,
      bizKey: 'comment:reply:1:to:1001',
      payload: {
        receiverUserId: 1001,
        type: MessageNotificationTypeEnum.COMMENT_REPLY,
        title: 'fallback title',
        content: 'fallback content',
      },
      status: MessageOutboxStatusEnum.PENDING,
      retryCount: 0,
      nextRetryAt: null,
      lastError: null,
      processedAt: null,
      createdAt: new Date('2026-03-28T16:10:00.000Z'),
    }

    const update = jest.fn()
      .mockImplementationOnce(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([]),
          })),
        })),
      }))
      .mockImplementationOnce(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([{ id: event.id }]),
          })),
        })),
      }))
      .mockImplementationOnce(() => ({
        set: jest.fn(() => ({
          where: jest.fn().mockResolvedValue({ rowCount: 1 }),
        })),
      }))

    const select = jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          orderBy: jest.fn(() => ({
            limit: jest.fn().mockResolvedValue([event]),
          })),
        })),
      })),
    }))
    const assertAffectedRows = jest.fn()
    const createFromOutbox = jest.fn().mockResolvedValue({
      status: MessageNotificationDispatchStatusEnum.DELIVERED,
      notification: { id: 88 },
    })
    const upsertDeliveryForOutboxEvent = jest.fn().mockResolvedValue(undefined)

    const worker = new MessageOutboxWorker(
      {
        db: { select, update },
        schema: {
          messageOutbox: {
            id: 'id',
            status: 'status',
            nextRetryAt: 'nextRetryAt',
            lastError: 'lastError',
            processedAt: 'processedAt',
          },
        },
        assertAffectedRows,
      } as any,
      {
        createFromOutbox,
      } as any,
      {
        upsertDeliveryForOutboxEvent,
      } as any,
      {
        get: jest.fn(),
      } as any,
    )

    await worker.consumeOutbox()

    expect(createFromOutbox).toHaveBeenCalledWith(
      event.bizKey,
      event.payload,
    )
    expect(assertAffectedRows).toHaveBeenCalledWith(
      { rowCount: 1 },
      'Outbox 事件不存在',
    )
    expect(upsertDeliveryForOutboxEvent).toHaveBeenCalledWith(
      event,
      expect.objectContaining({
        status: MessageNotificationDispatchStatusEnum.DELIVERED,
        retryCount: 0,
        notificationId: 88,
      }),
    )
  })

  it('records retrying delivery result on recoverable error', async () => {
    const { MessageOutboxWorker } = await import('./outbox.worker')

    const upsertDeliveryForOutboxEvent = jest.fn().mockResolvedValue(undefined)
    const worker = new MessageOutboxWorker(
      {
        db: {
          update: jest.fn(() => ({
            set: jest.fn(() => ({
              where: jest.fn().mockResolvedValue({ rowCount: 1 }),
            })),
          })),
        },
        schema: {
          messageOutbox: {
            id: 'id',
            status: 'status',
            retryCount: 'retryCount',
            nextRetryAt: 'nextRetryAt',
            lastError: 'lastError',
            processedAt: 'processedAt',
          },
        },
        assertAffectedRows: jest.fn(),
      } as any,
      {} as any,
      {
        upsertDeliveryForOutboxEvent,
      } as any,
      {
        get: jest.fn(),
      } as any,
    )

    const event = {
      id: 10001n,
      bizKey: 'comment:reply:1:to:1001',
      domain: MessageOutboxDomainEnum.NOTIFICATION,
      retryCount: 0,
    }

    await (worker as any).handleProcessError(event, new Error('payload missing title'))

    expect(upsertDeliveryForOutboxEvent).toHaveBeenCalledWith(
      event,
      expect.objectContaining({
        status: MessageNotificationDispatchStatusEnum.RETRYING,
        retryCount: 1,
        failureReason: 'payload missing title',
      }),
    )
  })

  it('records failed delivery result when retry count reaches max', async () => {
    const { MessageOutboxWorker } = await import('./outbox.worker')

    const upsertDeliveryForOutboxEvent = jest.fn().mockResolvedValue(undefined)
    const worker = new MessageOutboxWorker(
      {
        db: {
          update: jest.fn(() => ({
            set: jest.fn(() => ({
              where: jest.fn().mockResolvedValue({ rowCount: 1 }),
            })),
          })),
        },
        schema: {
          messageOutbox: {
            id: 'id',
            status: 'status',
            retryCount: 'retryCount',
            nextRetryAt: 'nextRetryAt',
            lastError: 'lastError',
            processedAt: 'processedAt',
          },
        },
        assertAffectedRows: jest.fn(),
      } as any,
      {} as any,
      {
        upsertDeliveryForOutboxEvent,
      } as any,
      {
        get: jest.fn(),
      } as any,
    )

    const event = {
      id: 10001n,
      bizKey: 'comment:reply:1:to:1001',
      domain: MessageOutboxDomainEnum.NOTIFICATION,
      retryCount: MESSAGE_OUTBOX_MAX_RETRY - 1,
    }

    await (worker as any).handleProcessError(event, new Error('notification payload invalid'))

    expect(upsertDeliveryForOutboxEvent).toHaveBeenCalledWith(
      event,
      expect.objectContaining({
        status: MessageNotificationDispatchStatusEnum.FAILED,
        retryCount: MESSAGE_OUTBOX_MAX_RETRY,
        failureReason: 'notification payload invalid',
      }),
    )
  })

  it('dispatches chat outbox event through message chat service without writing notification delivery', async () => {
    const { MessageOutboxWorker } = await import('./outbox.worker')

    const event = {
      id: 10002n,
      domain: MessageOutboxDomainEnum.CHAT,
      eventType: ChatOutboxEventTypeEnum.MESSAGE_CREATED,
      bizKey: 'chat:message:created:5001',
      payload: {
        conversationId: 9,
        messageId: '5001',
      },
      status: MessageOutboxStatusEnum.PENDING,
      retryCount: 0,
      nextRetryAt: null,
      lastError: null,
      processedAt: null,
      createdAt: new Date('2026-03-29T15:00:00.000Z'),
    }

    const update = jest.fn()
      .mockImplementationOnce(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([]),
          })),
        })),
      }))
      .mockImplementationOnce(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([{ id: event.id }]),
          })),
        })),
      }))
      .mockImplementationOnce(() => ({
        set: jest.fn(() => ({
          where: jest.fn().mockResolvedValue({ rowCount: 1 }),
        })),
      }))

    const select = jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          orderBy: jest.fn(() => ({
            limit: jest.fn().mockResolvedValue([event]),
          })),
        })),
      })),
    }))
    const dispatchMessageCreatedOutboxEvent = jest
      .fn()
      .mockResolvedValue(undefined)
    const upsertDeliveryForOutboxEvent = jest.fn().mockResolvedValue(undefined)
    const assertAffectedRows = jest.fn()

    const worker = new MessageOutboxWorker(
      {
        db: { select, update },
        schema: {
          messageOutbox: {
            id: 'id',
            status: 'status',
            nextRetryAt: 'nextRetryAt',
            lastError: 'lastError',
            processedAt: 'processedAt',
          },
        },
        assertAffectedRows,
      } as any,
      {
        createFromOutbox: jest.fn(),
      } as any,
      {
        upsertDeliveryForOutboxEvent,
      } as any,
      {
        get: jest.fn().mockReturnValue({
          dispatchMessageCreatedOutboxEvent,
        }),
      } as any,
    )

    await worker.consumeOutbox()

    expect(dispatchMessageCreatedOutboxEvent).toHaveBeenCalledWith({
      conversationId: 9,
      messageId: '5001',
    })
    expect(upsertDeliveryForOutboxEvent).not.toHaveBeenCalled()
    expect(assertAffectedRows).toHaveBeenCalledWith(
      { rowCount: 1 },
      'Outbox 事件不存在',
    )
  })
})
