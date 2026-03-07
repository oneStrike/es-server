import type { AuthConfigInterface } from '@libs/base/types'
import type { Server, Socket } from 'socket.io'
import type { MessageChatService } from '../chat/chat.service'
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ModuleRef } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { ChatMessageTypeEnum, MESSAGE_CHAT_SERVICE_TOKEN } from '../chat/chat.constant'
import { MessageWsMonitorService } from '../monitor/ws-monitor.service'

/** WebSocket 请求信封结构 */
interface WsRequestEnvelope<TPayload> {
  requestId?: string
  timestamp?: number
  payload?: TPayload
}

/** WebSocket 发送消息载荷 */
interface WsSendPayload {
  conversationId: number
  clientMessageId?: string
  messageType: number
  content: string
  payload?: unknown
}

/** WebSocket 已读消息载荷 */
interface WsReadPayload {
  conversationId: number
  messageId: string
}

/** WebSocket 应答载荷 */
interface WsAckPayload {
  requestId: string | null
  code: number
  message: string
  data?: unknown
}

/**
 * 消息 WebSocket 网关
 * 处理实时消息通信，包括聊天消息发送和已读标记
 */
@Injectable()
@WebSocketGateway({
  namespace: '/message',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class MessageGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server?: Server

  private readonly logger = new Logger(MessageGateway.name)
  private messageChatService?: MessageChatService

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly moduleRef: ModuleRef,
    private readonly messageWsMonitorService: MessageWsMonitorService,
  ) {}

  /**
   * 处理 WebSocket 连接
   * 验证 JWT 令牌并加入用户房间
   */
  async handleConnection(client: Socket) {
    const userId = await this.resolveUserId(client)
    if (!userId) {
      client.disconnect(true)
      return
    }
    client.data.userId = userId
    void client.join(this.getUserRoom(userId))
    this.recordReconnectMetric()
  }

  /** 处理 WebSocket 断开连接 */
  handleDisconnect(client: Socket) {
    const userId = Number(client.data.userId)
    if (!Number.isInteger(userId) || userId <= 0) {
      return
    }
    void client.leave(this.getUserRoom(userId))
  }

  /** 向指定用户发送事件 */
  emitToUser(userId: number, event: string, payload: unknown) {
    if (!this.server || !Number.isInteger(userId) || userId <= 0) {
      return
    }
    this.server.to(this.getUserRoom(userId)).emit(event, payload)
  }

  /**
   * 处理聊天消息发送
   * 通过 WebSocket 实时发送聊天消息
   */
  @SubscribeMessage('chat.send')
  async handleChatSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: WsRequestEnvelope<WsSendPayload>,
  ) {
    const requestStartAt = Date.now()
    this.recordRequestMetric()

    const requestId = this.normalizeRequestId(body?.requestId)
    if (!requestId) {
      this.emitAck(client, {
        requestId: null,
        code: 40001,
        message: 'requestId 不能为空',
      }, requestStartAt)
      return
    }

    const userId = this.extractAuthenticatedUserId(client)
    if (!userId) {
      this.emitAck(client, {
        requestId,
        code: 40101,
        message: '未授权',
      }, requestStartAt)
      client.disconnect(true)
      return
    }

    const payload = body?.payload
    if (!payload || !this.isValidSendPayload(payload)) {
      this.emitAck(client, {
        requestId,
        code: 40001,
        message: '无效的 chat.send 载荷',
      }, requestStartAt)
      return
    }

    try {
      const clientMessageId
        = typeof payload.clientMessageId === 'string' && payload.clientMessageId.trim()
          ? payload.clientMessageId.trim()
          : undefined
      const result = await this.getMessageChatService().sendMessage(userId, {
        conversationId: payload.conversationId,
        messageType: payload.messageType as ChatMessageTypeEnum,
        content: payload.content.trim(),
        clientMessageId,
        payload: this.stringifyPayloadObject(payload.payload),
      })

      this.emitAck(client, {
        requestId,
        code: 0,
        message: 'ok',
        data: {
          ...result,
          clientMessageId,
        },
      }, requestStartAt)
    } catch (error) {
      this.emitAck(client, {
        requestId,
        ...this.mapErrorToAck(error),
      }, requestStartAt)
    }
  }

  /**
   * 处理聊天消息已读标记
   * 通过 WebSocket 实时标记消息已读
   */
  @SubscribeMessage('chat.read')
  async handleChatRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: WsRequestEnvelope<WsReadPayload>,
  ) {
    const requestStartAt = Date.now()
    this.recordRequestMetric()

    const requestId = this.normalizeRequestId(body?.requestId)
    if (!requestId) {
      this.emitAck(client, {
        requestId: null,
        code: 40001,
        message: 'requestId 不能为空',
      }, requestStartAt)
      return
    }

    const userId = this.extractAuthenticatedUserId(client)
    if (!userId) {
      this.emitAck(client, {
        requestId,
        code: 40101,
        message: '未授权',
      }, requestStartAt)
      client.disconnect(true)
      return
    }

    const payload = body?.payload
    if (
      !payload
      || !this.isPositiveInteger(payload.conversationId)
      || typeof payload.messageId !== 'string'
      || !/^\d+$/.test(payload.messageId.trim())
    ) {
      this.emitAck(client, {
        requestId,
        code: 40001,
        message: '无效的 chat.read 载荷',
      }, requestStartAt)
      return
    }

    try {
      const result = await this.getMessageChatService().markConversationRead(
        userId,
        {
          conversationId: payload.conversationId,
          messageId: payload.messageId.trim(),
        },
      )
      this.emitAck(client, {
        requestId,
        code: 0,
        message: 'ok',
        data: result,
      }, requestStartAt)
    } catch (error) {
      this.emitAck(client, {
        requestId,
        ...this.mapErrorToAck(error),
      }, requestStartAt)
    }
  }

  /** 获取用户房间名称 */
  private getUserRoom(userId: number) {
    return `user:${userId}`
  }

  /** 获取消息聊天服务实例（延迟加载） */
  private getMessageChatService() {
    if (!this.messageChatService) {
      this.messageChatService = this.moduleRef.get<MessageChatService>(
        MESSAGE_CHAT_SERVICE_TOKEN,
        { strict: false },
      )
    }
    if (!this.messageChatService) {
      throw new Error('MessageChatService 不可用')
    }
    return this.messageChatService
  }

  /** 解析用户ID（从 JWT 令牌） */
  private async resolveUserId(client: Socket) {
    const token = this.extractToken(client)
    if (!token) {
      return null
    }

    const authConfig = this.configService.get<AuthConfigInterface>('auth')
    const publicKey = this.configService.get<string>('rsa.publicKey')
    if (!authConfig || !publicKey) {
      this.logger.warn('消息网关缺少认证配置')
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

  /** 从客户端提取令牌 */
  private extractToken(client: Socket) {
    const authToken = client.handshake.auth?.token
    if (typeof authToken === 'string' && authToken.trim()) {
      return this.normalizeBearerToken(authToken)
    }

    const queryToken = client.handshake.query?.token
    if (typeof queryToken === 'string' && queryToken.trim()) {
      return this.normalizeBearerToken(queryToken)
    }
    if (Array.isArray(queryToken) && queryToken[0]?.trim()) {
      return this.normalizeBearerToken(queryToken[0])
    }

    const headerToken = client.handshake.headers?.authorization
    if (typeof headerToken === 'string' && headerToken.trim()) {
      return this.normalizeBearerToken(headerToken)
    }

    return null
  }

  /** 标准化 Bearer 令牌 */
  private normalizeBearerToken(value: string) {
    const token = value.trim()
    if (token.startsWith('Bearer ')) {
      return token.slice(7)
    }
    return token
  }

  /** 发送应答消息 */
  private emitAck(client: Socket, payload: WsAckPayload, requestStartAt?: number) {
    client.emit('chat.ack', payload)
    if (Number.isFinite(requestStartAt)) {
      const latencyMs = Math.max(0, Date.now() - Number(requestStartAt))
      this.recordAckMetric(payload.code, latencyMs)
    }
  }

  /** 标准化请求ID */
  private normalizeRequestId(requestId?: string) {
    if (typeof requestId !== 'string' || !requestId.trim()) {
      return undefined
    }
    return requestId.trim().slice(0, 100)
  }

  /** 提取已认证的用户ID */
  private extractAuthenticatedUserId(client: Socket) {
    const userId = Number(client.data.userId)
    if (!Number.isInteger(userId) || userId <= 0) {
      return null
    }
    return userId
  }

  /** 判断是否为正整数 */
  private isPositiveInteger(value: unknown) {
    const normalized = Number(value)
    return Number.isInteger(normalized) && normalized > 0
  }

  /** 判断是否为有效的消息类型 */
  private isValidMessageType(value: unknown) {
    return (
      value === ChatMessageTypeEnum.TEXT
      || value === ChatMessageTypeEnum.IMAGE
      || value === ChatMessageTypeEnum.SYSTEM
    )
  }

  /** 验证发送消息载荷是否有效 */
  private isValidSendPayload(payload: WsSendPayload) {
    if (!this.isPositiveInteger(payload.conversationId)) {
      return false
    }
    if (!this.isValidMessageType(payload.messageType)) {
      return false
    }
    if (typeof payload.content !== 'string' || !payload.content.trim()) {
      return false
    }
    if (
      payload.clientMessageId !== undefined
      && (typeof payload.clientMessageId !== 'string'
        || !payload.clientMessageId.trim()
        || payload.clientMessageId.trim().length > 64)
    ) {
      return false
    }
    if (
      payload.payload !== undefined
      && (typeof payload.payload !== 'object'
        || payload.payload === null
        || Array.isArray(payload.payload))
    ) {
      return false
    }
    return true
  }

  /** 将载荷对象序列化为字符串 */
  private stringifyPayloadObject(payload: unknown) {
    if (payload === undefined) {
      return undefined
    }

    if (
      typeof payload !== 'object'
      || payload === null
      || Array.isArray(payload)
    ) {
      throw new BadRequestException('payload 必须是 JSON 对象')
    }

    return JSON.stringify(payload)
  }

  /** 将错误映射为应答载荷 */
  private mapErrorToAck(error: unknown): Omit<WsAckPayload, 'requestId'> {
    if (error instanceof BadRequestException) {
      return {
        code: 40001,
        message: this.getErrorMessage(error, '请求参数错误'),
      }
    }

    if (error instanceof NotFoundException) {
      const message = this.getErrorMessage(error, '资源不存在')
      return {
        code: message.toLowerCase().includes('message') ? 40402 : 40401,
        message,
      }
    }

    this.logger.error(
      '消息网关 WebSocket 处理失败',
      error instanceof Error ? error.stack : String(error),
    )
    return {
      code: 50001,
      message: '服务器内部错误',
    }
  }

  /** 从异常中提取错误消息 */
  private getErrorMessage(error: { getResponse: () => unknown }, fallback: string) {
    const response = error.getResponse()
    if (typeof response === 'string' && response.trim()) {
      return response
    }
    if (
      typeof response === 'object'
      && response !== null
      && 'message' in response
    ) {
      const message = (response as { message?: unknown }).message
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

  private recordRequestMetric() {
    void this.messageWsMonitorService.recordRequest().catch((error) => {
      this.logger.warn(`记录 WS 请求监控失败: ${this.stringifyError(error)}`)
    })
  }

  private recordAckMetric(code: number, latencyMs: number) {
    void this.messageWsMonitorService.recordAck(code, latencyMs).catch((error) => {
      this.logger.warn(`记录 WS ack 监控失败: ${this.stringifyError(error)}`)
    })
  }

  private recordReconnectMetric() {
    void this.messageWsMonitorService.recordReconnect().catch((error) => {
      this.logger.warn(`记录 WS 连接监控失败: ${this.stringifyError(error)}`)
    })
  }

  private stringifyError(error: unknown) {
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
