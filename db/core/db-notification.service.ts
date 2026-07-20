import type { Client, Notification, Pool } from 'pg'
import type {
  DbNotificationMetrics,
  DbNotificationSubscription,
  DbNotificationSubscriptionOptions,
} from './db-notification.type'
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common'
import { Client as PgClient } from 'pg'
import { DRIZZLE_POOL, DRIZZLE_RUNTIME_CONFIG } from './drizzle.provider'
import { buildSafeDatabaseDiagnostic } from './error/error-handler'

const POSTGRES_NOTIFICATION_CHANNEL_REGEX = /^[A-Z_]\w{0,62}$/i
const RECONNECT_BASE_DELAY_MS = 250
const RECONNECT_MAX_DELAY_MS = 10_000
const SAFE_ERROR_NAME_PATTERN = /^[a-z][\w.-]{0,63}$/i

interface NotificationCallback {
  onNotification: (notification: Notification) => void
  onError?: (error: Error) => void
}

interface NotificationChannel {
  callbacks: Set<NotificationCallback>
}

interface DbNotificationRuntimeConfig {
  connectionString: string
  listenerConnections: 0 | 1
}

/**
 * 稳定的低层 PostgreSQL LISTEN/NOTIFY 原语，用于跨实例协调。
 *
 * 查询流量仍走共享 `Pool`；一个进程内所有订阅通过一个独立的 `pg.Client` 多路复用，
 * 按通道和引用计数回调分发通知。
 */
@Injectable()
export class DbNotificationService implements OnApplicationShutdown {
  private readonly logger = new Logger(DbNotificationService.name)
  private readonly channels = new Map<string, NotificationChannel>()
  private readonly listeningChannels = new Set<string>()
  private operationQueue: Promise<void> = Promise.resolve()
  private client?: Client
  private reconnectTimer?: NodeJS.Timeout
  private reconnectAttempt = 0
  private reconnectCount = 0
  private errorCount = 0
  private reconnectDelayMs: number | null = null
  private isShuttingDown = false

  constructor(
    @Inject(DRIZZLE_POOL) private readonly pool: Pool,
    @Inject(DRIZZLE_RUNTIME_CONFIG)
    private readonly runtimeConfig: DbNotificationRuntimeConfig,
  ) {}

  /** 向指定 PostgreSQL 通知通道发布 payload。 */
  async notify(channel: string, payload: string): Promise<void> {
    const validatedChannel = normalizeNotificationChannel(channel)
    await this.pool.query('SELECT pg_notify($1, $2)', [
      validatedChannel,
      payload,
    ])
  }

  /**
   * 建立指定通道的订阅。一个进程中同一通道只会执行一次 LISTEN，多个回调共用
   * 同一个独立 listener client。
   */
  async subscribe(
    options: DbNotificationSubscriptionOptions,
  ): Promise<DbNotificationSubscription> {
    if (this.isShuttingDown) {
      throw new Error('DbNotificationService is shutting down')
    }

    if (this.runtimeConfig.listenerConnections !== 1) {
      throw new Error(
        'Database notification listener is disabled for this process role',
      )
    }

    const channel = normalizeNotificationChannel(options.channel)
    const callback: NotificationCallback = {
      onNotification: options.onNotification,
      onError: options.onError,
    }
    const channelState = this.channels.get(channel) ?? { callbacks: new Set() }
    channelState.callbacks.add(callback)
    this.channels.set(channel, channelState)

    await this.enqueue(async () => {
      await this.ensureListener()
    })

    let isClosed = false
    return {
      close: async () => {
        if (isClosed) {
          return
        }

        isClosed = true
        await this.unsubscribe(channel, callback)
      },
    }
  }

  /** 返回 listener 的连接、重连和订阅数量，供 health/metrics owner 读取。 */
  getMetrics(): DbNotificationMetrics {
    return {
      configuredListenerConnections: this.runtimeConfig.listenerConnections,
      activeListenerConnections: this.client ? 1 : 0,
      connected: this.client !== undefined,
      channelCount: this.channels.size,
      subscriptionCount: [...this.channels.values()].reduce(
        (total, channel) => total + channel.callbacks.size,
        0,
      ),
      reconnectCount: this.reconnectCount,
      errorCount: this.errorCount,
      reconnectDelayMs: this.reconnectDelayMs,
      isShuttingDown: this.isShuttingDown,
    }
  }

  /** 释放全部活动订阅，并阻止后续新订阅建立。 */
  async closeAllSubscriptions(): Promise<void> {
    if (this.isShuttingDown) {
      return
    }

    this.isShuttingDown = true
    this.clearReconnectTimer()
    this.channels.clear()

    await this.enqueue(async () => {
      await this.closeActiveClient()
    })
  }

  /** 应用关闭时释放独立 listener client。 */
  async onApplicationShutdown(): Promise<void> {
    await this.closeAllSubscriptions()
  }

  // 移除回调并按需 UNLISTEN 通道；最后一个回调移除后关闭独立 listener client。
  private async unsubscribe(
    channel: string,
    callback: NotificationCallback,
  ): Promise<void> {
    const channelState = this.channels.get(channel)
    if (!channelState) {
      return
    }

    channelState.callbacks.delete(callback)
    if (channelState.callbacks.size > 0) {
      return
    }

    this.channels.delete(channel)

    await this.enqueue(async () => {
      if (this.channels.size === 0) {
        this.clearReconnectTimer()
        await this.closeActiveClient()
        return
      }

      const client = this.client
      if (!client) {
        return
      }

      if (!this.listeningChannels.delete(channel)) {
        return
      }

      try {
        await client.query(`UNLISTEN ${quoteIdentifier(channel)}`)
      } catch (error) {
        await this.handleClientFailure(client, toError(error))
      }
    })
  }

  // 按需创建或复用独立 listener client，并同步当前所有通道的 LISTEN。
  private async ensureListener(): Promise<void> {
    if (this.isShuttingDown || this.channels.size === 0) {
      return
    }

    const currentClient = this.client
    if (currentClient) {
      try {
        await this.syncListeningChannels(currentClient)
      } catch (error) {
        await this.handleClientFailure(currentClient, toError(error))
      }
      return
    }

    const client = new PgClient({
      connectionString: this.runtimeConfig.connectionString,
    })
    client.on('notification', this.handleNotification)
    client.on('error', (error) => {
      void this.enqueue(async () => {
        await this.handleClientFailure(client, error)
      })
    })
    client.on('end', () => {
      void this.enqueue(async () => {
        await this.handleClientFailure(
          client,
          new Error('PostgreSQL notification listener ended unexpectedly'),
        )
      })
    })

    try {
      await client.connect()
      if (this.isShuttingDown || this.channels.size === 0) {
        await this.endClient(client)
        return
      }

      this.client = client
      await this.syncListeningChannels(client)
      this.reconnectAttempt = 0
      this.reconnectDelayMs = null
    } catch (error) {
      if (this.client === client) {
        this.client = undefined
      }
      this.listeningChannels.clear()
      await this.endClient(client)
      this.reportListenerFailure(toError(error))
    }
  }

  // 对当前 client 补齐尚未 LISTEN 的通道。
  private async syncListeningChannels(client: Client): Promise<void> {
    for (const channel of this.channels.keys()) {
      if (this.listeningChannels.has(channel)) {
        continue
      }

      await client.query(`LISTEN ${quoteIdentifier(channel)}`)
      this.listeningChannels.add(channel)
    }
  }

  // 处理 listener client 故障：清理状态、通知订阅者并调度重连。
  private async handleClientFailure(
    client: Client,
    error: Error,
  ): Promise<void> {
    if (this.client !== client) {
      return
    }

    this.client = undefined
    this.listeningChannels.clear()
    await this.endClient(client)
    this.reportListenerFailure(error)
  }

  // 记录 listener 故障日志并通知所有订阅者的 onError 回调。
  private reportListenerFailure(error: Error): void {
    if (this.isShuttingDown) {
      return
    }

    this.errorCount += 1
    this.logger.warn('Database notification listener failed', {
      database: buildSafeDatabaseDiagnostic(error),
    })
    this.notifySubscriberErrors(error)
    this.scheduleReconnect()
  }

  // 按指数退避策略调度下一次重连尝试。
  private scheduleReconnect(): void {
    if (
      this.isShuttingDown ||
      this.channels.size === 0 ||
      this.reconnectTimer
    ) {
      return
    }

    this.reconnectAttempt += 1
    this.reconnectCount += 1
    const cappedDelay = Math.min(
      RECONNECT_MAX_DELAY_MS,
      RECONNECT_BASE_DELAY_MS * 2 ** (this.reconnectAttempt - 1),
    )
    this.reconnectDelayMs = Math.floor(Math.random() * (cappedDelay + 1))

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined
      this.reconnectDelayMs = null
      void this.enqueue(async () => {
        await this.ensureListener()
      })
    }, this.reconnectDelayMs)
  }

  // 关闭当前活动 client 并清理通道状态。
  private async closeActiveClient(): Promise<void> {
    const client = this.client
    this.client = undefined
    this.listeningChannels.clear()

    if (client) {
      await this.endClient(client)
    }
  }

  // 安全关闭 listener client 并移除事件监听。
  private async endClient(client: Client): Promise<void> {
    client.removeListener('notification', this.handleNotification)

    try {
      await client.end()
    } catch (error) {
      this.logger.warn('Failed to close database notification listener', {
        database: buildSafeDatabaseDiagnostic(error),
      })
    }
  }

  // 向所有通道的所有订阅者广播错误回调。
  private notifySubscriberErrors(error: Error): void {
    for (const channel of this.channels.values()) {
      for (const callback of channel.callbacks) {
        this.invokeCallbackError(callback, error)
      }
    }
  }

  // 收到 PostgreSQL NOTIFY 时按通道分发到对应回调。
  private readonly handleNotification = (notification: Notification) => {
    const channel = notification.channel
    if (!channel) {
      return
    }

    const channelState = this.channels.get(channel)
    if (!channelState) {
      return
    }

    for (const callback of channelState.callbacks) {
      try {
        callback.onNotification(notification)
      } catch (error) {
        this.errorCount += 1
        const callbackError = toError(error)
        this.logger.error(
          `Database notification callback failed for channel "${channel}": ${getSafeErrorName(callbackError)}`,
        )
        this.invokeCallbackError(callback, callbackError)
      }
    }
  }

  // 通知单个订阅者的 onError 回调，捕获并记录回调自身的异常。
  private invokeCallbackError(
    callback: NotificationCallback,
    error: Error,
  ): void {
    try {
      callback.onError?.(error)
    } catch (callbackError) {
      this.errorCount += 1
      this.logger.error(
        `Database notification error callback failed: ${getSafeErrorName(callbackError)}`,
      )
    }
  }

  // 清除挂起的重连定时器。
  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) {
      return
    }

    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = undefined
    this.reconnectDelayMs = null
  }

  // 将操作串行化排队，保证 LISTEN/UNLISTEN 和连接管理不会交错执行。
  private async enqueue(operation: () => Promise<void>): Promise<void> {
    const queuedOperation = this.operationQueue.then(operation, operation)
    this.operationQueue = queuedOperation.then(
      () => undefined,
      () => undefined,
    )
    await queuedOperation
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

function getSafeErrorName(error: unknown): string {
  if (error instanceof Error && SAFE_ERROR_NAME_PATTERN.test(error.name)) {
    return error.name
  }
  return 'UnknownError'
}

function normalizeNotificationChannel(channel: string): string {
  if (POSTGRES_NOTIFICATION_CHANNEL_REGEX.test(channel)) {
    return channel
  }

  throw new Error(`Invalid PostgreSQL notification channel: ${channel}`)
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`
}
