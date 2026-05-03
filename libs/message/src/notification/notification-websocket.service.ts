import type { AuthConfigInterface } from '@libs/platform/types'
import type { WebSocket } from 'ws'
import type { MessageChatService } from '../chat/chat.service'
import type {
  NativeWsAuthResult,
  NativeWsClientState,
  NativeWsGatewaySendResult,
  WsAckPayload,
  WsAuthPayload,
  WsReadPayload,
  WsRequestEnvelope,
  WsSendPayload,
} from './notification-websocket.type'
import {
  BusinessErrorCode,
  getPlatformErrorCode,
  PlatformErrorCode,
} from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { AuthErrorMessages } from '@libs/platform/modules/auth/helpers'
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
  private readonly nativeClientState = new WeakMap<
    WebSocket,
    NativeWsClientState
  >()

  private messageChatService?: MessageChatService

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly moduleRef: ModuleRef,
    private readonly messageWsMonitorService: MessageWsMonitorService,
    private readonly userCoreService: UserService,
  ) {}

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
          authResult.code ?? 40101,
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
  }

  // 注销 native ws 客户端连接，并同步回收用户连接索引。
  unregisterNativeClient(client: WebSocket) {
    const userId = this.nativeClientState.get(client)?.userId
    if (userId) {
      this.removeNativeClientFromUser(userId, client)
    }

    this.nativeClientState.delete(client)
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
      data: payload,
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
      data: {
        requestId,
        code,
        message,
      },
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
