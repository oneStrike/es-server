import type { DbNotificationSubscription } from '@db/core'
import type { ApiErrorCode } from '@libs/platform/constant'
import type { JwtPayload } from '@libs/platform/modules/auth/types'
import type { AuthConfigInterface } from '@libs/platform/types'
import type { Notification } from 'pg'
import type { WebSocket } from 'ws'
import type {
  MessageWsFanoutEnvelope,
  NativeWsAuthResult,
  NativeWsClientState,
  NativeWsGatewaySendResult,
  WsAckPayload,
  WsAuthPayload,
} from './notification-websocket.type'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { DbNotificationService } from '@db/core'
import { PlatformErrorCode } from '@libs/platform/constant'
import { AuthErrorMessages } from '@libs/platform/modules/auth/helpers'
import { UserService } from '@libs/user/user.service'
import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { MessageWsMonitorService } from '../monitor/ws-monitor.service'

const NATIVE_WS_OPEN = 1
const MESSAGE_WS_FANOUT_CHANNEL = 'message_ws_fanout'
const POSTGRES_NOTIFY_PAYLOAD_LIMIT_BYTES = 7_600

@Injectable()
export class MessageWebSocketService implements OnApplicationShutdown {
  private readonly logger = new Logger(MessageWebSocketService.name)
  private readonly instanceId = randomUUID()
  private readonly nativeClientsByUserId = new Map<number, Set<WebSocket>>()
  private readonly nativeClientState = new WeakMap<
    WebSocket,
    NativeWsClientState
  >()

  private crossInstanceSubscription?: DbNotificationSubscription
  private crossInstanceSubscriptionPromise?: Promise<void>
  private isShuttingDown = false
  private readonly handleCrossInstanceListenerError = (error: Error) => {
    this.logger.warn(
      `Message WS fanout listener disconnected: ${this.stringifyError(error)}`,
    )
  }

  private readonly handleCrossInstanceFanout = (message: Notification) => {
    if (message.channel !== MESSAGE_WS_FANOUT_CHANNEL || !message.payload) {
      return
    }

    const envelope = this.parseCrossInstanceFanout(message.payload)
    if (!envelope || envelope.sourceId === this.instanceId) {
      return
    }

    this.emitToLocalUser(envelope.userId, envelope.event, envelope.payload)
  }

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly messageWsMonitorService: MessageWsMonitorService,
    private readonly userCoreService: UserService,
    private readonly dbNotificationService: DbNotificationService,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    this.isShuttingDown = true
    if (this.crossInstanceSubscriptionPromise) {
      await this.crossInstanceSubscriptionPromise
    }

    const subscription = this.crossInstanceSubscription
    this.crossInstanceSubscription = undefined
    if (!subscription) {
      return
    }

    await subscription.close()
  }

  // 初始化 native ws 客户端状态，连接建立后等待 auth 事件绑定用户。
  initializeNativeClient(client: WebSocket) {
    this.nativeClientState.set(client, { userId: null })
  }

  // 处理 native ws auth 事件，成功时把连接绑定到当前用户。
  async authenticateNativeClient(
    client: WebSocket,
    payload: WsAuthPayload,
  ): Promise<NativeWsGatewaySendResult> {
    const authResult = await this.resolveNativeAuthToken(payload?.token)
    if (!authResult.userId) {
      return {
        message: this.createNativeAuthErrorMessage(
          authResult.code ?? PlatformErrorCode.UNAUTHORIZED,
          authResult.message,
        ),
        shouldClose: authResult.shouldClose,
      }
    }

    this.bindNativeUser(client, authResult.userId)
    return {
      message: this.createNativeAuthOkMessage(authResult.userId),
      shouldClose: false,
    }
  }

  // 读取 native ws 客户端当前绑定的用户 ID，未鉴权时返回 null。
  getNativeClientUserId(client: WebSocket) {
    return this.nativeClientState.get(client)?.userId ?? null
  }

  // 解析原生 WS auth 事件中的 token，并复用共享用户状态事实源。
  async resolveNativeAuthToken(
    token?: string | null,
  ): Promise<NativeWsAuthResult> {
    const userId = await this.authenticateToken(token)
    if (!userId) {
      return {
        userId: null,
        code: PlatformErrorCode.UNAUTHORIZED,
        message: 'Authentication failed',
        shouldClose: false,
      }
    }

    const accessCheck = await this.userCoreService.getAppUserAccessCheck(userId)
    if (accessCheck.allowed) {
      return {
        userId,
        message: 'ok',
        shouldClose: false,
      }
    }

    if (accessCheck.reason === 'not_found') {
      return {
        userId: null,
        code: PlatformErrorCode.UNAUTHORIZED,
        message: AuthErrorMessages.LOGIN_INVALID,
        shouldClose: true,
      }
    }

    if (accessCheck.reason === 'disabled') {
      return {
        userId: null,
        code: PlatformErrorCode.FORBIDDEN,
        message: accessCheck.message,
        shouldClose: true,
      }
    }

    return {
      userId: null,
      code: accessCheck.code,
      message: accessCheck.message,
      shouldClose: true,
    }
  }

  // 校验访问令牌并提取用户 ID。 仅接受 access token，配置缺失或校验失败时返回 null。
  async authenticateToken(token?: string | null) {
    if (!token) {
      return null
    }

    const authConfig = this.configService.get<AuthConfigInterface>('auth')
    const publicKey = this.configService.get<string>('rsa.publicKey')
    if (!authConfig || !publicKey) {
      this.logger.warn('WebSocket auth config is missing')
      return null
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        publicKey,
        algorithms: ['RS256'],
        audience: authConfig.aud,
        issuer: authConfig.iss,
      })

      if (payload.type !== 'access') {
        return null
      }

      const userId = Number(payload.sub)
      if (!Number.isInteger(userId) || userId <= 0) {
        return null
      }

      return userId
    } catch {
      return null
    }
  }

  // 把 native ws 连接绑定到指定用户，并在身份切换时回收旧绑定。
  private bindNativeUser(client: WebSocket, userId: number) {
    if (!Number.isInteger(userId) || userId <= 0) {
      return
    }

    const state = this.nativeClientState.get(client) ?? { userId: null }
    if (state.userId === userId) {
      return
    }

    if (state.userId) {
      this.removeNativeClientFromUser(state.userId, client)
    }

    state.userId = userId
    this.nativeClientState.set(client, state)

    let clients = this.nativeClientsByUserId.get(userId)
    if (!clients) {
      clients = new Set<WebSocket>()
      this.nativeClientsByUserId.set(userId, clients)
    }

    clients.add(client)
    this.recordReconnectMetric()
    void this.ensureCrossInstanceListener()
  }

  // 注销 native ws 客户端连接，并同步回收用户连接索引。
  unregisterNativeClient(client: WebSocket) {
    const userId = this.nativeClientState.get(client)?.userId
    if (userId) {
      this.removeNativeClientFromUser(userId, client)
    }

    this.nativeClientState.delete(client)
    void this.stopCrossInstanceListenerIfIdle()
  }

  // 从指定用户连接集合中移除一个 native ws 客户端。
  private removeNativeClientFromUser(userId: number, client: WebSocket) {
    const clients = this.nativeClientsByUserId.get(userId)
    if (!clients) {
      return
    }

    clients.delete(client)
    if (!clients.size) {
      this.nativeClientsByUserId.delete(userId)
    }
  }

  /**
   * 向指定用户广播事件。
   * 仅覆盖 Nest WsAdapter 管理的 native ws 连接集合。
   */
  emitToUser<TPayload>(userId: number, event: string, payload: TPayload) {
    if (!Number.isInteger(userId) || userId <= 0) {
      return
    }

    this.emitToLocalUser(userId, event, payload)
    void this.publishCrossInstanceFanout(userId, event, payload)
  }

  private emitToLocalUser<TPayload>(
    userId: number,
    event: string,
    payload: TPayload,
  ) {
    const nativeClients = this.nativeClientsByUserId.get(userId)
    if (!nativeClients?.size) {
      return
    }

    const message = this.createNativeEventMessage(event, payload)
    for (const client of [...nativeClients]) {
      if (client.readyState !== NATIVE_WS_OPEN) {
        this.unregisterNativeClient(client)
        continue
      }

      try {
        client.send(message)
      } catch (error) {
        this.logger.warn(
          `Failed to push native WS event: ${this.stringifyError(error)}`,
        )
        this.unregisterNativeClient(client)
      }
    }
  }

  private async ensureCrossInstanceListener(): Promise<void> {
    if (this.isShuttingDown) {
      return
    }

    if (this.crossInstanceSubscription) {
      return
    }

    if (this.crossInstanceSubscriptionPromise) {
      return this.crossInstanceSubscriptionPromise
    }

    this.crossInstanceSubscriptionPromise =
      this.createCrossInstanceSubscription()
    return this.crossInstanceSubscriptionPromise
  }

  private async createCrossInstanceSubscription() {
    try {
      const subscription = await this.dbNotificationService.subscribe({
        channel: MESSAGE_WS_FANOUT_CHANNEL,
        onNotification: this.handleCrossInstanceFanout,
        onError: this.handleCrossInstanceListenerError,
      })

      if (this.isShuttingDown) {
        await subscription.close()
        return
      }

      this.crossInstanceSubscription = subscription
      if (this.nativeClientsByUserId.size === 0) {
        await this.stopCrossInstanceListenerIfIdle()
      }
    } catch (error) {
      this.logger.warn(
        `Failed to start message WS fanout listener: ${this.stringifyError(error)}`,
      )
    } finally {
      this.crossInstanceSubscriptionPromise = undefined
    }
  }

  private async stopCrossInstanceListenerIfIdle() {
    if (this.nativeClientsByUserId.size > 0) {
      return
    }

    const subscription = this.crossInstanceSubscription
    this.crossInstanceSubscription = undefined
    if (!subscription) {
      return
    }

    await subscription.close()
  }

  private async publishCrossInstanceFanout<TPayload>(
    userId: number,
    event: string,
    payload: TPayload,
  ) {
    const envelope: MessageWsFanoutEnvelope = {
      sourceId: this.instanceId,
      userId,
      event,
      payload,
    }
    const serialized = JSON.stringify(envelope)
    if (
      Buffer.byteLength(serialized, 'utf8') >
      POSTGRES_NOTIFY_PAYLOAD_LIMIT_BYTES
    ) {
      this.logger.warn(
        `Skip oversized message WS fanout payload event=${event} userId=${userId}`,
      )
      this.recordFanoutSkippedMetric()
      return
    }

    try {
      await this.dbNotificationService.notify(
        MESSAGE_WS_FANOUT_CHANNEL,
        serialized,
      )
    } catch (error) {
      this.logger.warn(
        `Failed to publish message WS fanout: ${this.stringifyError(error)}`,
      )
      this.recordFanoutPublishFailedMetric()
    }
  }

  private parseCrossInstanceFanout(
    payload: string,
  ): MessageWsFanoutEnvelope | null {
    try {
      const envelope = JSON.parse(payload) as Partial<MessageWsFanoutEnvelope>
      if (
        typeof envelope.sourceId !== 'string' ||
        typeof envelope.event !== 'string' ||
        typeof envelope.userId !== 'number' ||
        !Number.isInteger(envelope.userId) ||
        envelope.userId <= 0
      ) {
        return null
      }
      return envelope as MessageWsFanoutEnvelope
    } catch (error) {
      this.logger.warn(
        `Failed to parse message WS fanout payload: ${this.stringifyError(error)}`,
      )
      return null
    }
  }

  /**
   * 构造原生 WS 事件消息体。
   */
  createNativeEventMessage<TPayload>(event: string, data?: TPayload): string {
    const message = data === undefined ? { event } : { event, data }
    return JSON.stringify(message)
  }

  // 构造原生 WS ack 消息体。
  createNativeAckMessage(payload: WsAckPayload) {
    return JSON.stringify({
      event: 'chat.ack',
      data: payload,
    })
  }

  // 构造原生 WS 错误消息体。
  createNativeErrorMessage(
    code: ApiErrorCode,
    message: string,
    requestId: string | null = null,
  ) {
    return JSON.stringify({
      event: 'ws.error',
      data: {
        requestId,
        code,
        message,
      },
    })
  }

  // 构造原生 WS 鉴权必需提示消息。
  createNativeAuthRequiredMessage() {
    return this.createNativeEventMessage('ws.auth.required', {
      message: 'Authentication required',
    })
  }

  // 构造原生 WS 鉴权成功消息。
  createNativeAuthOkMessage(userId: number) {
    return this.createNativeEventMessage('ws.auth.ok', { userId })
  }

  // 构造原生 WS 鉴权失败消息。
  createNativeAuthErrorMessage(
    code: ApiErrorCode = PlatformErrorCode.UNAUTHORIZED,
    message = 'Authentication failed',
  ) {
    return this.createNativeEventMessage('ws.auth.error', {
      code,
      message,
    })
  }

  // 记录 websocket 重连指标。
  private recordReconnectMetric() {
    void this.messageWsMonitorService.recordReconnect().catch((error) => {
      this.logger.warn(
        `Failed to record WS reconnect metric: ${this.stringifyError(error)}`,
      )
    })
  }

  // 记录跨实例 fanout 因 PostgreSQL notify 载荷限制被跳过。
  private recordFanoutSkippedMetric() {
    void this.messageWsMonitorService.recordFanoutSkipped().catch((error) => {
      this.logger.warn(
        `Failed to record WS fanout skipped metric: ${this.stringifyError(error)}`,
      )
    })
  }

  // 记录跨实例 fanout 发布失败。
  private recordFanoutPublishFailedMetric() {
    void this.messageWsMonitorService
      .recordFanoutPublishFailed()
      .catch((error) => {
        this.logger.warn(
          `Failed to record WS fanout publish metric: ${this.stringifyError(error)}`,
        )
      })
  }

  // 把未知错误对象收敛成日志可读文本。
  private stringifyError(error: unknown): string {
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
}
