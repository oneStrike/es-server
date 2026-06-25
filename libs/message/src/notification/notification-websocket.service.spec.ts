import type { Notification } from 'pg'
import type { WebSocket } from 'ws'
import { MessageWebSocketService } from './notification-websocket.service'

const FANOUT_CHANNEL = 'message_ws_fanout'

interface NotificationSubscriptionOptions {
  channel: string
  onNotification: (message: Notification) => void
  onError?: (error: Error) => void
}

function createService() {
  const subscription = {
    close: jest.fn(async () => undefined),
  }
  let subscriptionOptions: NotificationSubscriptionOptions | undefined
  const dbNotificationService = {
    notify: jest.fn(async () => undefined),
    subscribe: jest.fn(async (options: NotificationSubscriptionOptions) => {
      subscriptionOptions = options
      return subscription
    }),
  }
  const configService = {
    get: jest.fn((key: string) => (key === 'upload' ? {} : undefined)),
  }
  const monitorService = {
    recordAck: jest.fn(async () => undefined),
    recordFanoutPublishFailed: jest.fn(async () => undefined),
    recordFanoutSkipped: jest.fn(async () => undefined),
    recordReconnect: jest.fn(async () => undefined),
    recordRequest: jest.fn(async () => undefined),
  }

  const service = new MessageWebSocketService(
    { verifyAsync: jest.fn() } as never,
    configService as never,
    { get: jest.fn() } as never,
    monitorService as never,
    { getAppUserAccessCheck: jest.fn() } as never,
    dbNotificationService as never,
  )

  return {
    dbNotificationService,
    getSubscriptionOptions: () => subscriptionOptions,
    monitorService,
    service,
    subscription,
  }
}

function bindNativeUser(
  service: MessageWebSocketService,
  client: WebSocket,
  userId: number,
) {
  ;(
    service as unknown as {
      bindNativeUser: (client: WebSocket, userId: number) => void
    }
  ).bindNativeUser(client, userId)
}

async function flushAsyncWork() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('MessageWebSocketService cross-instance fanout', () => {
  it('publishes websocket events through DbNotificationService for remote app instances', async () => {
    const { dbNotificationService, service } = createService()

    service.emitToUser(42, 'inbox.summary.updated', { totalUnreadCount: 3 })
    await flushAsyncWork()

    expect(dbNotificationService.notify).toHaveBeenCalledWith(
      FANOUT_CHANNEL,
      expect.any(String),
    )
    const notifyCall = dbNotificationService.notify.mock
      .calls[0] as unknown as [string, string]
    const payload = JSON.parse(notifyCall[1])
    expect(payload).toMatchObject({
      userId: 42,
      event: 'inbox.summary.updated',
      payload: { totalUnreadCount: 3 },
    })
    expect(typeof payload.sourceId).toBe('string')
  })

  it('starts the cross-instance subscription only after the first local user binds', async () => {
    const { dbNotificationService, service } = createService()
    const client = {
      readyState: 1,
      send: jest.fn(),
    } as unknown as WebSocket

    service.initializeNativeClient(client)
    expect(dbNotificationService.subscribe).not.toHaveBeenCalled()

    bindNativeUser(service, client, 7)
    await flushAsyncWork()

    expect(dbNotificationService.subscribe).toHaveBeenCalledWith({
      channel: FANOUT_CHANNEL,
      onNotification: expect.any(Function),
      onError: expect.any(Function),
    })
  })

  it('delivers remote fanout payloads to local clients without republishing', async () => {
    const { dbNotificationService, getSubscriptionOptions, service } =
      createService()

    const client = {
      readyState: 1,
      send: jest.fn(),
    } as unknown as WebSocket
    service.initializeNativeClient(client)
    bindNativeUser(service, client, 7)
    await flushAsyncWork()

    getSubscriptionOptions()?.onNotification({
      channel: FANOUT_CHANNEL,
      payload: JSON.stringify({
        sourceId: 'remote-instance',
        userId: 7,
        event: 'chat.conversation.update',
        payload: { conversationId: 10 },
      }),
    } as Notification)

    expect(client.send).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'chat.conversation.update',
        data: { conversationId: 10 },
      }),
    )
    expect(dbNotificationService.notify).not.toHaveBeenCalled()
  })

  it('ignores fanout notifications published by the same app instance', async () => {
    const { dbNotificationService, getSubscriptionOptions, service } =
      createService()

    const client = {
      readyState: 1,
      send: jest.fn(),
    } as unknown as WebSocket
    service.initializeNativeClient(client)
    bindNativeUser(service, client, 7)
    await flushAsyncWork()

    const sourceId = (service as unknown as { instanceId: string }).instanceId
    getSubscriptionOptions()?.onNotification({
      channel: FANOUT_CHANNEL,
      payload: JSON.stringify({
        sourceId,
        userId: 7,
        event: 'chat.conversation.update',
        payload: { conversationId: 10 },
      }),
    } as Notification)

    expect(client.send).not.toHaveBeenCalled()
    expect(dbNotificationService.notify).not.toHaveBeenCalled()
  })

  it('skips oversized PostgreSQL notify payloads', () => {
    const { dbNotificationService, monitorService, service } = createService()

    service.emitToUser(42, 'chat.message.created', {
      body: 'x'.repeat(8_000),
    })

    expect(dbNotificationService.notify).not.toHaveBeenCalled()
    expect(monitorService.recordFanoutSkipped).toHaveBeenCalled()
  })

  it('records fanout publish failures for monitor visibility', async () => {
    const { dbNotificationService, monitorService, service } = createService()
    dbNotificationService.notify.mockRejectedValueOnce(
      new Error('notify failed'),
    )

    service.emitToUser(42, 'chat.message.created', { body: 'hello' })
    await flushAsyncWork()

    expect(monitorService.recordFanoutPublishFailed).toHaveBeenCalled()
  })

  it('releases the cross-instance subscription when the last local user disconnects', async () => {
    const { service, subscription } = createService()
    const client = {
      readyState: 1,
      send: jest.fn(),
    } as unknown as WebSocket

    service.initializeNativeClient(client)
    bindNativeUser(service, client, 7)
    await flushAsyncWork()

    service.unregisterNativeClient(client)
    await flushAsyncWork()

    expect(subscription.close).toHaveBeenCalledTimes(1)
  })

  it('closes the active cross-instance subscription on shutdown', async () => {
    const { service, subscription } = createService()
    const client = {
      readyState: 1,
      send: jest.fn(),
    } as unknown as WebSocket

    service.initializeNativeClient(client)
    bindNativeUser(service, client, 7)
    await flushAsyncWork()

    await service.onApplicationShutdown()

    expect(subscription.close).toHaveBeenCalledTimes(1)
  })
})
