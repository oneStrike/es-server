import type { Pool, PoolClient } from 'pg'
import type { WebSocket } from 'ws'
import { EventEmitter } from 'node:events'
import { MessageWebSocketService } from './notification-websocket.service'

const FANOUT_CHANNEL = 'message_ws_fanout'

interface TestPoolClient extends PoolClient {
  emit: EventEmitter['emit']
  query: jest.Mock
  release: jest.Mock
}

function createPoolClient(): TestPoolClient {
  const client = new EventEmitter() as EventEmitter & {
    query: jest.Mock
    release: jest.Mock
  }
  client.query = jest.fn(async () => ({ rowCount: 0, rows: [] }))
  client.release = jest.fn()
  return client as TestPoolClient
}

function createService() {
  const listener = createPoolClient()
  const pool = {
    connect: jest.fn(async () => listener),
    query: jest.fn(async () => ({ rowCount: 1, rows: [] })),
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
    pool as unknown as Pool,
  )

  return { listener, monitorService, pool, service }
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
  it('publishes websocket events to PostgreSQL notify for remote app instances', () => {
    const { pool, service } = createService()

    service.emitToUser(42, 'inbox.summary.updated', { totalUnreadCount: 3 })

    expect(pool.query).toHaveBeenCalledWith('SELECT pg_notify($1, $2)', [
      FANOUT_CHANNEL,
      expect.any(String),
    ])
    const call = pool.query.mock.calls[0] as unknown as [
      string,
      [string, string],
    ]
    const payload = JSON.parse(call[1][1])
    expect(payload).toMatchObject({
      userId: 42,
      event: 'inbox.summary.updated',
      payload: { totalUnreadCount: 3 },
    })
    expect(typeof payload.sourceId).toBe('string')
  })

  it('delivers remote fanout payloads to local clients without republishing', async () => {
    const { listener, pool, service } = createService()

    const client = {
      readyState: 1,
      send: jest.fn(),
    } as unknown as WebSocket
    service.initializeNativeClient(client)
    bindNativeUser(service, client, 7)
    await flushAsyncWork()

    listener.emit('notification', {
      channel: FANOUT_CHANNEL,
      payload: JSON.stringify({
        sourceId: 'remote-instance',
        userId: 7,
        event: 'chat.conversation.update',
        payload: { conversationId: 10 },
      }),
    })

    expect(client.send).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'chat.conversation.update',
        data: { conversationId: 10 },
      }),
    )
    expect(pool.query).not.toHaveBeenCalled()

    await service.onApplicationShutdown()
  })

  it('ignores fanout notifications published by the same app instance', async () => {
    const { listener, pool, service } = createService()

    const client = {
      readyState: 1,
      send: jest.fn(),
    } as unknown as WebSocket
    service.initializeNativeClient(client)
    bindNativeUser(service, client, 7)
    await flushAsyncWork()

    const sourceId = (service as unknown as { instanceId: string }).instanceId
    listener.emit('notification', {
      channel: FANOUT_CHANNEL,
      payload: JSON.stringify({
        sourceId,
        userId: 7,
        event: 'chat.conversation.update',
        payload: { conversationId: 10 },
      }),
    })

    expect(client.send).not.toHaveBeenCalled()
    expect(pool.query).not.toHaveBeenCalled()

    await service.onApplicationShutdown()
  })

  it('skips oversized PostgreSQL notify payloads', () => {
    const { monitorService, pool, service } = createService()

    service.emitToUser(42, 'chat.message.created', {
      body: 'x'.repeat(8_000),
    })

    expect(pool.query).not.toHaveBeenCalled()
    expect(monitorService.recordFanoutSkipped).toHaveBeenCalled()
  })

  it('records fanout publish failures for monitor visibility', async () => {
    const { monitorService, pool, service } = createService()
    pool.query.mockRejectedValueOnce(new Error('notify failed'))

    service.emitToUser(42, 'chat.message.created', { body: 'hello' })
    await flushAsyncWork()

    expect(monitorService.recordFanoutPublishFailed).toHaveBeenCalled()
  })

  it('reconnects the fanout listener after listener errors while users are bound', async () => {
    jest.useFakeTimers()
    const { listener, pool, service } = createService()

    const client = {
      readyState: 1,
      send: jest.fn(),
    } as unknown as WebSocket
    service.initializeNativeClient(client)
    bindNativeUser(service, client, 7)
    await flushAsyncWork()

    const error = new Error('listener disconnected')
    listener.emit('error', error)

    expect(listener.release).toHaveBeenCalledWith(error)

    jest.advanceTimersByTime(1_000)
    await Promise.resolve()
    await Promise.resolve()

    expect(pool.connect).toHaveBeenCalledTimes(2)

    jest.useRealTimers()
    await service.onApplicationShutdown()
  })

  it('unlistens and releases the fanout listener on shutdown', async () => {
    const { listener, service } = createService()
    const client = {
      readyState: 1,
      send: jest.fn(),
    } as unknown as WebSocket
    service.initializeNativeClient(client)
    bindNativeUser(service, client, 7)
    await flushAsyncWork()

    await service.onApplicationShutdown()

    expect(listener.query).toHaveBeenCalledWith(`UNLISTEN ${FANOUT_CHANNEL}`)
    expect(listener.release).toHaveBeenCalledWith()
  })

  it('releases a fanout listener that finishes connecting during shutdown', async () => {
    const { listener, pool, service } = createService()
    let resolveConnect!: (client: TestPoolClient) => void
    pool.connect.mockImplementationOnce(
      () =>
        new Promise<TestPoolClient>((resolve) => {
          resolveConnect = resolve
        }),
    )
    const client = {
      readyState: 1,
      send: jest.fn(),
    } as unknown as WebSocket

    service.initializeNativeClient(client)
    bindNativeUser(service, client, 7)
    const shutdownPromise = service.onApplicationShutdown()
    await flushAsyncWork()

    expect(listener.release).not.toHaveBeenCalled()

    resolveConnect(listener)
    await shutdownPromise

    expect(listener.query).toHaveBeenCalledWith(`LISTEN ${FANOUT_CHANNEL}`)
    expect(listener.query).toHaveBeenCalledWith(`UNLISTEN ${FANOUT_CHANNEL}`)
    expect(listener.release).toHaveBeenCalledWith()
  })

  it('retries the fanout listener when user binding follows an initial startup failure', async () => {
    jest.useFakeTimers()
    const { listener, pool, service } = createService()
    pool.connect
      .mockRejectedValueOnce(new Error('listener boot failed'))
      .mockResolvedValueOnce(listener)

    const client = {
      readyState: 1,
      send: jest.fn(),
    } as unknown as WebSocket

    service.initializeNativeClient(client)
    await flushAsyncWork()
    expect(pool.connect).not.toHaveBeenCalled()

    bindNativeUser(service, client, 9)
    await flushAsyncWork()

    expect(pool.connect).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(1_000)
    await flushAsyncWork()

    expect(pool.connect).toHaveBeenCalledTimes(2)
    expect(listener.query).toHaveBeenCalledWith(`LISTEN ${FANOUT_CHANNEL}`)

    jest.useRealTimers()
    await service.onApplicationShutdown()
  })

  it('releases the fanout listener when the last local user disconnects', async () => {
    const { listener, service } = createService()
    const client = {
      readyState: 1,
      send: jest.fn(),
    } as unknown as WebSocket

    service.initializeNativeClient(client)
    bindNativeUser(service, client, 7)
    await flushAsyncWork()

    service.unregisterNativeClient(client)
    await flushAsyncWork()

    expect(listener.query).toHaveBeenCalledWith(`UNLISTEN ${FANOUT_CHANNEL}`)
    expect(listener.release).toHaveBeenCalledWith()
  })
})
