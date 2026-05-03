import type { AuthConfigInterface } from '@libs/platform/types'
import type { IncomingMessage } from 'node:http'
import type { Server, Socket } from 'socket.io'
import type { WebSocket } from 'ws'
import type { MessageChatService } from '../chat/chat.service'
import type {
  NativeWsAuthResult,
  WsAckPayload,
  WsReadPayload,
  WsRequestEnvelope,
  WsSendPayload,
} from './notification-websocket.type'
import process from 'node:process'
import {
  BusinessErrorCode,
  getPlatformErrorCode,
  PlatformErrorCode,
} from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { AuthErrorMessages } from '@libs/platform/modules/auth/helpers'
import { isDevelopment } from '@libs/platform/utils'
import { UserService } from '@libs/user/user.service'
import { HttpException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ModuleRef } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { normalizeChatMessageSendInput } from '../chat/chat-message-boundary'
import { MESSAGE_CHAT_SERVICE_TOKEN } from '../chat/chat.constant'
import { MessageWsMonitorService } from '../monitor/ws-monitor.service'

const DIGIT_STRING_REGEX = /^\d+$/
const NATIVE_WS_OPEN = 1

@Injectable()
export class MessageWebSocketService {
  private readonly logger = new Logger(MessageWebSocketService.name)
  private readonly nativeClientsByUserId = new Map<number, Set<WebSocket>>()

  private messageChatService?: MessageChatService
  private socketServer?: Server

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly moduleRef: ModuleRef,
    private readonly messageWsMonitorService: MessageWsMonitorService,
    private readonly userCoreService: UserService,
  ) {}

  /**
   * 解析 Socket.IO 的跨域白名单配置。
   * 本地开发默认放开，生产环境仅使用显式配置的来源列表。
   */
  getSocketIoCorsOrigin() {
    const origins = (process.env.MESSAGE_WS_CORS_ORIGINS || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    if (origins.length > 0) {
      return origins.includes('*') ? true : origins
    }

    return !!isDevelopment()
  }

  /**
   * 绑定 Socket.IO 服务实例。
   * 供 gateway 初始化后把底层 server 注入到消息推送服务中。
   */
  bindSocketServer(server: Server) {
    this.socketServer = server
  }

  /**
   * 生成用户专属房间名。
   * Socket.IO 与原生 WS 都使用同一套 user room 语义。
   */
  getUserRoom(userId: number) {
    return `user:${userId}`
  }

  /**
   * 解析 Socket.IO 握手里的用户身份。
   */
  async resolveSocketIoUserId(client: Socket) {
    const userId = await this.authenticateToken(
      this.extractSocketIoToken(client),
    )
    return this.resolveAllowedUserId(userId)
  }

  /**
   * 解析原生 WS 握手请求里的用户身份。
   */
  async resolveNativeRequestUserId(request: IncomingMessage) {
    const authResult = await this.resolveNativeRequestAuth(request)
    return authResult.userId
  }

  /**
   * 解析原生 WS 初始握手请求，并保留失败协议语义。
   */
  async resolveNativeRequestAuth(
    request: IncomingMessage,
  ): Promise<NativeWsAuthResult> {
    const token = this.extractNativeRequestToken(request)
    if (!token) {
      return {
        userId: null,
        message: 'Authentication required',
        shouldClose: false,
      }
    }

    return this.resolveNativeAuthToken(token)
  }

  /**
   * 解析原生 WS auth 事件中的 token，并复用共享用户状态事实源。
   */
  async resolveNativeAuthToken(
    token?: string | null,
  ): Promise<NativeWsAuthResult> {
    const userId = await this.authenticateToken(token)
    if (!userId) {
      return {
        userId: null,
        code: 40101,
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
        code: 40101,
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

  /**
   * 校验访问令牌并提取用户 ID。
   * 仅接受 access token，配置缺失或校验失败时返回 null。
   */
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
      const payload = await this.jwtService.verifyAsync(token, {
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

  // 解析已通过 token 校验的用户是否仍允许进入 WS。
  private async resolveAllowedUserId(userId: number | null) {
    if (!userId) {
      return null
    }

    const accessCheck = await this.userCoreService.getAppUserAccessCheck(userId)
    return accessCheck.allowed ? userId : null
  }

  // 构造事件级用户状态拒绝 ack，供 chat.send/read 前置拦截复用。
  private async buildAccessDeniedAck(
    userId: number,
    requestId: string,
  ): Promise<WsAckPayload | null> {
    const accessCheck = await this.userCoreService.getAppUserAccessCheck(userId)
    if (accessCheck.allowed) {
      return null
    }

    if (accessCheck.reason === 'not_found') {
      return {
        requestId,
        code: 40101,
        message: 'Unauthorized',
      }
    }

    if (accessCheck.reason === 'disabled') {
      return {
        requestId,
        code: PlatformErrorCode.FORBIDDEN,
        message: accessCheck.message,
      }
    }

    return {
      requestId,
      code: accessCheck.code,
      message: accessCheck.message,
    }
  }

  /**
   * 注册原生 WS 客户端连接。
   * 同一用户允许持有多个连接，并记录一次重连指标。
   */
  registerNativeClient(userId: number, client: WebSocket) {
    if (!Number.isInteger(userId) || userId <= 0) {
      return
    }

    let clients = this.nativeClientsByUserId.get(userId)
    if (!clients) {
      clients = new Set<WebSocket>()
      this.nativeClientsByUserId.set(userId, clients)
    }

    clients.add(client)
    this.recordReconnectMetric()
  }

  /**
   * 注销原生 WS 客户端连接。
   * 当用户没有剩余连接时同步回收映射项。
   */
  unregisterNativeClient(userId: number, client: WebSocket) {
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
   * 同时覆盖 Socket.IO 房间和原生 WS 连接集合。
   */
  emitToUser<TPayload>(userId: number, event: string, payload: TPayload) {
    if (!Number.isInteger(userId) || userId <= 0) {
      return
    }

    if (this.socketServer) {
      this.socketServer.to(this.getUserRoom(userId)).emit(event, payload)
    }

    const nativeClients = this.nativeClientsByUserId.get(userId)
    if (!nativeClients?.size) {
      return
    }

    const message = this.createNativeEventMessage(event, payload)
    for (const client of [...nativeClients]) {
      if (client.readyState !== NATIVE_WS_OPEN) {
        this.unregisterNativeClient(userId, client)
        continue
      }

      try {
        client.send(message)
      } catch (error) {
        this.logger.warn(
          `Failed to push native WS event: ${this.stringifyError(error)}`,
        )
        this.unregisterNativeClient(userId, client)
      }
    }
  }

  /**
   * 处理聊天发送请求。
   * 负责鉴权、参数校验、发送消息并统一封装 ack。
   */
  async handleChatSend(
    userId: number | null,
    body: WsRequestEnvelope<WsSendPayload>,
  ): Promise<WsAckPayload> {
    const requestStartAt = Date.now()
    this.recordRequestMetric()

    const requestId = this.normalizeRequestId(body?.requestId)
    if (!requestId) {
      return this.finishAck(
        {
          requestId: null,
          code: 40001,
          message: 'requestId is required',
        },
        requestStartAt,
      )
    }

    if (!userId) {
      return this.finishAck(
        {
          requestId,
          code: 40101,
          message: 'Unauthorized',
        },
        requestStartAt,
      )
    }

    const accessDeniedAck = await this.buildAccessDeniedAck(userId, requestId)
    if (accessDeniedAck) {
      return this.finishAck(accessDeniedAck, requestStartAt)
    }

    const payload = body?.payload
    if (!payload) {
      return this.finishAck(
        {
          requestId,
          code: 40001,
          message: 'Invalid chat.send payload',
        },
        requestStartAt,
      )
    }

    const normalizedPayload = normalizeChatMessageSendInput(payload)
    if (!normalizedPayload.ok) {
      return this.finishAck(
        {
          requestId,
          code: 40001,
          message: 'Invalid chat.send payload',
        },
        requestStartAt,
      )
    }

    try {
      const result = await this.getMessageChatService().sendMessage(userId, {
        conversationId: normalizedPayload.value.conversationId,
        messageType: normalizedPayload.value.messageType,
        content: normalizedPayload.value.content,
        clientMessageId: normalizedPayload.value.clientMessageId,
        payload: normalizedPayload.value.payloadJson,
      })

      return this.finishAck(
        {
          requestId,
          code: 0,
          message: 'ok',
          data: {
            ...result,
            clientMessageId: normalizedPayload.value.clientMessageId,
          },
        },
        requestStartAt,
      )
    } catch (error) {
      return this.finishAck(
        {
          requestId,
          ...this.mapErrorToAck(error),
        },
        requestStartAt,
      )
    }
  }

  /**
   * 处理会话已读请求。
   * 对 conversationId 与 messageId 做最小校验后委托聊天服务执行。
   */
  async handleChatRead(
    userId: number | null,
    body: WsRequestEnvelope<WsReadPayload>,
  ): Promise<WsAckPayload> {
    const requestStartAt = Date.now()
    this.recordRequestMetric()

    const requestId = this.normalizeRequestId(body?.requestId)
    if (!requestId) {
      return this.finishAck(
        {
          requestId: null,
          code: 40001,
          message: 'requestId is required',
        },
        requestStartAt,
      )
    }

    if (!userId) {
      return this.finishAck(
        {
          requestId,
          code: 40101,
          message: 'Unauthorized',
        },
        requestStartAt,
      )
    }

    const accessDeniedAck = await this.buildAccessDeniedAck(userId, requestId)
    if (accessDeniedAck) {
      return this.finishAck(accessDeniedAck, requestStartAt)
    }

    const payload = body?.payload
    if (
      !payload ||
      !this.isPositiveInteger(payload.conversationId) ||
      typeof payload.messageId !== 'string' ||
      !DIGIT_STRING_REGEX.test(payload.messageId.trim())
    ) {
      return this.finishAck(
        {
          requestId,
          code: 40001,
          message: 'Invalid chat.read payload',
        },
        requestStartAt,
      )
    }

    try {
      const result = await this.getMessageChatService().markConversationRead(
        userId,
        {
          conversationId: payload.conversationId,
          messageId: payload.messageId.trim(),
        },
      )

      return this.finishAck(
        {
          requestId,
          code: 0,
          message: 'ok',
          data: result,
        },
        requestStartAt,
      )
    } catch (error) {
      return this.finishAck(
        {
          requestId,
          ...this.mapErrorToAck(error),
        },
        requestStartAt,
      )
    }
  }

  /**
   * 构造原生 WS 事件消息体。
   */
  createNativeEventMessage<TPayload>(event: string, data?: TPayload) {
    return JSON.stringify(data === undefined ? { event } : { event, data })
  }

  /**
   * 构造原生 WS ack 消息体。
   */
  createNativeAckMessage(payload: WsAckPayload) {
    return JSON.stringify({
      event: 'chat.ack',
      ...payload,
    })
  }

  /**
   * 构造原生 WS 错误消息体。
   */
  createNativeErrorMessage(
    code: number,
    message: string,
    requestId: string | null = null,
  ) {
    return JSON.stringify({
      event: 'ws.error',
      requestId,
      code,
      message,
    })
  }

  /**
   * 构造原生 WS 鉴权必需提示消息。
   */
  createNativeAuthRequiredMessage() {
    return this.createNativeEventMessage('ws.auth.required', {
      message: 'Authentication required',
    })
  }

  /**
   * 构造原生 WS 鉴权成功消息。
   */
  createNativeAuthOkMessage(userId: number) {
    return this.createNativeEventMessage('ws.auth.ok', { userId })
  }

  /**
   * 构造原生 WS 鉴权失败消息。
   */
  createNativeAuthErrorMessage(
    code = 40101,
    message = 'Authentication failed',
  ) {
    return this.createNativeEventMessage('ws.auth.error', {
      code,
      message,
    })
  }

  /**
   * 判断 ack 后是否需要主动断开客户端连接。
   */
  shouldDisconnectAfterAck(ack: WsAckPayload) {
    return (
      ack.code === 40101 ||
      ack.code === PlatformErrorCode.FORBIDDEN ||
      ack.code === BusinessErrorCode.OPERATION_NOT_ALLOWED
    )
  }

  /**
   * 记录 ack 延迟指标并返回最终 ack 载荷。
   */
  private finishAck(payload: WsAckPayload, requestStartAt: number) {
    const latencyMs = Math.max(0, Date.now() - requestStartAt)
    this.recordAckMetric(payload.code, latencyMs)
    return payload
  }

  /**
   * 惰性解析聊天服务实例。
   * 避免 websocket 服务初始化阶段形成强耦合依赖。
   */
  private getMessageChatService() {
    if (!this.messageChatService) {
      this.messageChatService = this.moduleRef.get<MessageChatService>(
        MESSAGE_CHAT_SERVICE_TOKEN,
        { strict: false },
      )
    }

    if (!this.messageChatService) {
      throw new Error('MessageChatService is unavailable')
    }

    return this.messageChatService
  }

  /**
   * 从 Socket.IO 握手中提取访问令牌。
   */
  private extractSocketIoToken(client: Socket) {
    const authToken = client.handshake.auth?.token
    if (typeof authToken === 'string' && authToken.trim()) {
      return this.normalizeBearerToken(authToken)
    }

    const headerToken = client.handshake.headers?.authorization
    if (typeof headerToken === 'string' && headerToken.trim()) {
      return this.normalizeBearerToken(headerToken)
    }

    return null
  }

  /**
   * 从原生 WS 请求中提取访问令牌。
   * 只接受 Authorization 头，避免通过 URL query 暴露 access token。
   */
  private extractNativeRequestToken(request: IncomingMessage) {
    const authorization = request.headers.authorization
    if (typeof authorization === 'string' && authorization.trim()) {
      return this.normalizeBearerToken(authorization)
    }

    return null
  }

  /**
   * 标准化 Bearer token 字符串。
   */
  private normalizeBearerToken(value: string) {
    const token = value.trim()
    if (token.startsWith('Bearer ')) {
      return token.slice(7)
    }
    return token
  }

  /**
   * 标准化客户端 requestId。
   * 空字符串会被视为缺失，并统一限制最大长度。
   */
  private normalizeRequestId(requestId?: string) {
    if (typeof requestId !== 'string' || !requestId.trim()) {
      return undefined
    }
    return requestId.trim().slice(0, 100)
  }

  /**
   * 判断输入值是否为正整数。
   */
  private isPositiveInteger<T>(value: T) {
    const normalized = Number(value)
    return Number.isInteger(normalized) && normalized > 0
  }

  /**
   * 把领域异常映射为 websocket ack 错误码。
   */
  private mapErrorToAck<T>(error: T) {
    if (error instanceof BusinessException) {
      return {
        code: error.code,
        message: error.message,
      }
    }

    if (error instanceof HttpException) {
      const message = this.getErrorMessage(error, 'Bad request')
      return {
        code: getPlatformErrorCode(error.getStatus()),
        message,
      }
    }

    this.logger.error(
      'WebSocket request failed',
      error instanceof Error ? error.stack : String(error),
    )
    return {
      code: PlatformErrorCode.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    }
  }

  /**
   * 从 Nest 异常对象中提取用户可读错误信息。
   */
  private getErrorMessage(
    error: { getResponse: () => unknown },
    fallback: string,
  ) {
    const response = error.getResponse()
    if (typeof response === 'string' && response.trim()) {
      return response
    }
    if (
      typeof response === 'object' &&
      response !== null &&
      'message' in response
    ) {
      const { message } = response as { message?: string | string[] | null }
      if (typeof message === 'string' && message.trim()) {
        return message
      }
      if (Array.isArray(message) && message.length) {
        const first = message[0]
        if (typeof first === 'string' && first.trim()) {
          return first
        }
      }
    }
    return fallback
  }

  /**
   * 记录 websocket 请求总数指标。
   */
  private recordRequestMetric() {
    void this.messageWsMonitorService.recordRequest().catch((error) => {
      this.logger.warn(
        `Failed to record WS request metric: ${this.stringifyError(error)}`,
      )
    })
  }

  /**
   * 记录 websocket ack 结果与延迟指标。
   */
  private recordAckMetric(code: number, latencyMs: number) {
    void this.messageWsMonitorService
      .recordAck(code, latencyMs)
      .catch((error) => {
        this.logger.warn(
          `Failed to record WS ack metric: ${this.stringifyError(error)}`,
        )
      })
  }

  /**
   * 记录 websocket 重连指标。
   */
  private recordReconnectMetric() {
    void this.messageWsMonitorService.recordReconnect().catch((error) => {
      this.logger.warn(
        `Failed to record WS reconnect metric: ${this.stringifyError(error)}`,
      )
    })
  }

  /**
   * 把未知错误对象收敛成日志可读文本。
   */
  private stringifyError<T>(error: T) {
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
