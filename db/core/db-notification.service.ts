import type { Pool, PoolClient } from 'pg'
import type {
  DbNotificationSubscription,
  DbNotificationSubscriptionOptions,
} from './db-notification.type'
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common'
import { DRIZZLE_POOL } from './drizzle.provider'

const POSTGRES_NOTIFICATION_CHANNEL_REGEX = /^[A-Z_]\w{0,62}$/i

/**
 * Stable low-level PostgreSQL LISTEN/NOTIFY primitive for cross-instance coordination.
 * Domain modules own channel names and payload semantics; db/core only validates channel
 * identifiers and manages the underlying connection lifecycle.
 */
@Injectable()
export class DbNotificationService implements OnApplicationShutdown {
  private readonly logger = new Logger(DbNotificationService.name)
  private readonly subscriptions = new Set<PgNotificationSubscription>()
  private isShuttingDown = false

  constructor(@Inject(DRIZZLE_POOL) private readonly pool: Pool) {}

  /** 向指定 PostgreSQL 通知通道发布 payload。 */
  async notify(channel: string, payload: string): Promise<void> {
    const validatedChannel = normalizeNotificationChannel(channel)
    await this.pool.query('SELECT pg_notify($1, $2)', [
      validatedChannel,
      payload,
    ])
  }

  /** 建立指定通道的 LISTEN 订阅，并托管连接重试与释放。 */
  async subscribe(
    options: DbNotificationSubscriptionOptions,
  ): Promise<DbNotificationSubscription> {
    if (this.isShuttingDown) {
      throw new Error('DbNotificationService is shutting down')
    }

    const validatedChannel = normalizeNotificationChannel(options.channel)
    const subscription = new PgNotificationSubscription(
      this.pool,
      {
        ...options,
        channel: validatedChannel,
      },
      this.logger,
    )
    this.subscriptions.add(subscription)
    await subscription.start()

    return {
      close: async () => {
        this.subscriptions.delete(subscription)
        await subscription.close()
      },
    }
  }

  /** 释放全部活动 LISTEN 订阅，并阻止后续新订阅建立。 */
  async closeAllSubscriptions(): Promise<void> {
    this.isShuttingDown = true
    const subscriptions = [...this.subscriptions]
    this.subscriptions.clear()
    await Promise.all(subscriptions.map(async (subscription) => subscription.close()))
  }

  /** 应用关闭时释放全部活动 LISTEN 订阅。 */
  async onApplicationShutdown(): Promise<void> {
    await this.closeAllSubscriptions()
  }
}

class PgNotificationSubscription {
  private client?: PoolClient
  private connectPromise?: Promise<void>
  private reconnectTimer?: NodeJS.Timeout
  private isClosed = false

  constructor(
    private readonly pool: Pool,
    private readonly options: DbNotificationSubscriptionOptions,
    private readonly logger: Logger,
  ) {}

  async start(): Promise<void> {
    if (this.connectPromise) {
      return this.connectPromise
    }

    if (this.client || this.isClosed) {
      return
    }

    this.connectPromise = this.connect()
    return this.connectPromise
  }

  async close(): Promise<void> {
    this.isClosed = true

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }

    if (this.connectPromise) {
      await this.connectPromise
    }

    const client = this.client
    this.client = undefined
    if (!client) {
      return
    }

    await this.releaseClient(client)
  }

  private async connect(): Promise<void> {
    let client: PoolClient | undefined

    try {
      client = await this.pool.connect()
      if (this.isClosed) {
        client.release()
        return
      }

      client.on('notification', this.options.onNotification)
      client.on('error', this.handleClientError)
      await client.query(`LISTEN ${this.options.channel}`)

      if (this.isClosed) {
        await this.releaseClient(client)
        return
      }

      this.client = client
      client = undefined
    } catch (error) {
      if (client) {
        client.removeListener('notification', this.options.onNotification)
        client.removeListener('error', this.handleClientError)
        client.release(toError(error))
      }

      this.options.onError?.(toError(error))
      this.scheduleReconnect()
    } finally {
      this.connectPromise = undefined
    }
  }

  private readonly handleClientError = (error: Error) => {
    const client = this.client
    this.client = undefined

    if (client) {
      client.removeListener('notification', this.options.onNotification)
      client.removeListener('error', this.handleClientError)
      client.release(error)
    }

    this.options.onError?.(error)
    this.scheduleReconnect()
  }

  private scheduleReconnect() {
    if (this.isClosed || this.reconnectTimer) {
      return
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined
      void this.start()
    }, 1_000)
  }

  private async releaseClient(client: PoolClient) {
    client.removeListener('notification', this.options.onNotification)
    client.removeListener('error', this.handleClientError)

    try {
      await client.query(`UNLISTEN ${this.options.channel}`)
    } catch (error) {
      this.logger.warn(
        `Failed to unlisten db notification channel "${this.options.channel}": ${stringifyError(error)}`,
      )
    } finally {
      client.release()
    }
  }
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }

  if (typeof error === 'string' && error.trim()) {
    return new Error(error)
  }

  return new Error('Database notification listener failed')
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  try {
    return JSON.stringify(error)
  } catch {
    return 'unknown'
  }
}

function normalizeNotificationChannel(channel: string): string {
  if (POSTGRES_NOTIFICATION_CHANNEL_REGEX.test(channel)) {
    return channel
  }

  throw new Error(`Invalid PostgreSQL notification channel: ${channel}`)
}
