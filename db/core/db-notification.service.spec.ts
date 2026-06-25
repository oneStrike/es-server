import type { Notification, Pool, PoolClient } from 'pg'
import { EventEmitter } from 'node:events'
import { DbNotificationService } from './db-notification.service'

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
  const service = new DbNotificationService(pool as unknown as Pool)

  return { listener, pool, service }
}

async function flushAsyncWork() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('DbNotificationService', () => {
  it('publishes PostgreSQL notifications through pg_notify', async () => {
    const { pool, service } = createService()

    await service.notify(FANOUT_CHANNEL, '{"ok":true}')

    expect(pool.query).toHaveBeenCalledWith('SELECT pg_notify($1, $2)', [
      FANOUT_CHANNEL,
      '{"ok":true}',
    ])
  })

  it('rejects invalid notification channels before executing SQL', async () => {
    const { pool, service } = createService()

    await expect(
      service.notify('message_ws_fanout;drop table users', '{"ok":true}'),
    ).rejects.toThrow('Invalid PostgreSQL notification channel')
    await expect(
      service.subscribe({
        channel: 'message_ws_fanout;drop table users',
        onNotification: jest.fn(),
      }),
    ).rejects.toThrow('Invalid PostgreSQL notification channel')

    expect(pool.query).not.toHaveBeenCalled()
    expect(pool.connect).not.toHaveBeenCalled()
  })

  it('delivers subscribed notifications to the consumer callback', async () => {
    const { listener, service } = createService()
    const onNotification = jest.fn()

    const subscription = await service.subscribe({
      channel: FANOUT_CHANNEL,
      onNotification,
    })

    const payload = {
      channel: FANOUT_CHANNEL,
      payload: '{"event":"chat.message.created"}',
    } as Notification
    listener.emit('notification', payload)

    expect(onNotification).toHaveBeenCalledWith(payload)

    await subscription.close()
  })

  it('reconnects subscriptions after listener errors', async () => {
    jest.useFakeTimers()
    const { listener, pool, service } = createService()
    const onError = jest.fn()

    const subscription = await service.subscribe({
      channel: FANOUT_CHANNEL,
      onNotification: jest.fn(),
      onError,
    })

    const error = new Error('listener disconnected')
    listener.emit('error', error)

    expect(listener.release).toHaveBeenCalledWith(error)
    expect(onError).toHaveBeenCalledWith(error)

    jest.advanceTimersByTime(1_000)
    await flushAsyncWork()

    expect(pool.connect).toHaveBeenCalledTimes(2)

    jest.useRealTimers()
    await subscription.close()
  })

  it('retries startup after an initial connection failure', async () => {
    jest.useFakeTimers()
    const { listener, pool, service } = createService()
    const onError = jest.fn()
    pool.connect
      .mockRejectedValueOnce(new Error('listener boot failed'))
      .mockResolvedValueOnce(listener)

    const subscription = await service.subscribe({
      channel: FANOUT_CHANNEL,
      onNotification: jest.fn(),
      onError,
    })

    expect(pool.connect).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(1_000)
    await flushAsyncWork()

    expect(pool.connect).toHaveBeenCalledTimes(2)
    expect(listener.query).toHaveBeenCalledWith(`LISTEN ${FANOUT_CHANNEL}`)

    jest.useRealTimers()
    await subscription.close()
  })

  it('unlistens and releases the listener on close', async () => {
    const { listener, service } = createService()

    const subscription = await service.subscribe({
      channel: FANOUT_CHANNEL,
      onNotification: jest.fn(),
    })

    await subscription.close()

    expect(listener.query).toHaveBeenCalledWith(`UNLISTEN ${FANOUT_CHANNEL}`)
    expect(listener.release).toHaveBeenCalledWith()
  })

  it('releases a listener that finishes connecting during shutdown', async () => {
    const { listener, pool, service } = createService()
    let resolveConnect!: (client: TestPoolClient) => void
    pool.connect.mockImplementationOnce(
      () =>
        new Promise<TestPoolClient>((resolve) => {
          resolveConnect = resolve
        }),
    )

    const subscribePromise = service.subscribe({
      channel: FANOUT_CHANNEL,
      onNotification: jest.fn(),
    })

    await flushAsyncWork()
    const shutdownPromise = service.onApplicationShutdown()
    await flushAsyncWork()

    expect(listener.release).not.toHaveBeenCalled()

    resolveConnect(listener)
    await subscribePromise
    await shutdownPromise

    expect(listener.query).not.toHaveBeenCalledWith(`LISTEN ${FANOUT_CHANNEL}`)
    expect(listener.query).not.toHaveBeenCalledWith(
      `UNLISTEN ${FANOUT_CHANNEL}`,
    )
    expect(listener.release).toHaveBeenCalledWith()
  })

  it('closes active subscriptions on application shutdown', async () => {
    const { listener, service } = createService()

    await service.subscribe({
      channel: FANOUT_CHANNEL,
      onNotification: jest.fn(),
    })

    await service.onApplicationShutdown()

    expect(listener.query).toHaveBeenCalledWith(`UNLISTEN ${FANOUT_CHANNEL}`)
    expect(listener.release).toHaveBeenCalledWith()
  })
})
