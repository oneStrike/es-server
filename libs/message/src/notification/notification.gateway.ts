import type { AuthConfigInterface } from '@libs/base/types'
import type { Server, Socket } from 'socket.io'
import type { MessageChatService } from '../chat/chat.service'
import process from 'node:process'
import { isDevelopment } from '@libs/base/utils'
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
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
import {
  ChatMessageTypeEnum,
  MESSAGE_CHAT_SERVICE_TOKEN,
} from '../chat/chat.constant'
import { MessageWsMonitorService } from '../monitor/ws-monitor.service'

/** 鏁板瓧瀛楃涓叉鍒欒〃杈惧紡锛堟ā鍧椾綔鐢ㄥ煙锛岄伩鍏嶉噸澶嶇紪璇戯級 */
const DIGIT_STRING_REGEX = /^\d+$/

const MESSAGE_WS_CORS_ORIGINS = (process.env.MESSAGE_WS_CORS_ORIGINS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

const MESSAGE_WS_CORS_ORIGIN =
  MESSAGE_WS_CORS_ORIGINS.length > 0
    ? (MESSAGE_WS_CORS_ORIGINS.includes('*')
        ? true
        : MESSAGE_WS_CORS_ORIGINS)
    : (!!isDevelopment())

/** WebSocket 璇锋眰淇″皝缁撴瀯 */
interface WsRequestEnvelope<TPayload> {
  requestId?: string
  timestamp?: number
  payload?: TPayload
}

/** WebSocket 鍙戦€佹秷鎭浇鑽? */
interface WsSendPayload {
  conversationId: number
  clientMessageId?: string
  messageType: number
  content: string
  payload?: unknown
}

/** WebSocket 宸茶娑堟伅杞借嵎 */
interface WsReadPayload {
  conversationId: number
  messageId: string
}

/** WebSocket 搴旂瓟杞借嵎 */
interface WsAckPayload {
  requestId: string | null
  code: number
  message: string
  data?: unknown
}

/**
 * 娑堟伅 WebSocket 缃戝叧
 * 澶勭悊瀹炴椂娑堟伅閫氫俊锛屽寘鎷亰澶╂秷鎭彂閫佸拰宸茶鏍囪
 */
@Injectable()
@WebSocketGateway({
  namespace: '/message',
  cors: {
    origin: MESSAGE_WS_CORS_ORIGIN,
    credentials: MESSAGE_WS_CORS_ORIGIN !== false,
  },
})
export class MessageGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
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
   * 澶勭悊 WebSocket 杩炴帴
   * 楠岃瘉 JWT 浠ょ墝骞跺姞鍏ョ敤鎴锋埧闂?
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

  /** 澶勭悊 WebSocket 鏂紑杩炴帴 */
  handleDisconnect(client: Socket) {
    const userId = Number(client.data.userId)
    if (!Number.isInteger(userId) || userId <= 0) {
      return
    }
    void client.leave(this.getUserRoom(userId))
  }

  /** 鍚戞寚瀹氱敤鎴峰彂閫佷簨浠? */
  emitToUser(userId: number, event: string, payload: unknown) {
    if (!this.server || !Number.isInteger(userId) || userId <= 0) {
      return
    }
    this.server.to(this.getUserRoom(userId)).emit(event, payload)
  }

  /**
   * 澶勭悊鑱婂ぉ娑堟伅鍙戦€?
   * 閫氳繃 WebSocket 瀹炴椂鍙戦€佽亰澶╂秷鎭?
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
      this.emitAck(
        client,
        {
          requestId: null,
          code: 40001,
          message: 'requestId 涓嶈兘涓虹┖',
        },
        requestStartAt,
      )
      return
    }

    const userId = this.extractAuthenticatedUserId(client)
    if (!userId) {
      this.emitAck(
        client,
        {
          requestId,
          code: 40101,
          message: '未授权',
        },
        requestStartAt,
      )
      client.disconnect(true)
      return
    }

    const payload = body?.payload
    if (!payload || !this.isValidSendPayload(payload)) {
      this.emitAck(
        client,
        {
          requestId,
          code: 40001,
          message: '鏃犳晥鐨?chat.send 杞借嵎',
        },
        requestStartAt,
      )
      return
    }

    try {
      const clientMessageId =
        typeof payload.clientMessageId === 'string' &&
        payload.clientMessageId.trim()
          ? payload.clientMessageId.trim()
          : undefined
      const result = await this.getMessageChatService().sendMessage(userId, {
        conversationId: payload.conversationId,
        messageType: payload.messageType as ChatMessageTypeEnum,
        content: payload.content.trim(),
        clientMessageId,
        payload: this.stringifyPayloadObject(payload.payload),
      })

      this.emitAck(
        client,
        {
          requestId,
          code: 0,
          message: 'ok',
          data: {
            ...result,
            clientMessageId,
          },
        },
        requestStartAt,
      )
    } catch (error) {
      this.emitAck(
        client,
        {
          requestId,
          ...this.mapErrorToAck(error),
        },
        requestStartAt,
      )
    }
  }

  /**
   * 澶勭悊鑱婂ぉ娑堟伅宸茶鏍囪
   * 閫氳繃 WebSocket 瀹炴椂鏍囪娑堟伅宸茶
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
      this.emitAck(
        client,
        {
          requestId: null,
          code: 40001,
          message: 'requestId 涓嶈兘涓虹┖',
        },
        requestStartAt,
      )
      return
    }

    const userId = this.extractAuthenticatedUserId(client)
    if (!userId) {
      this.emitAck(
        client,
        {
          requestId,
          code: 40101,
          message: '未授权',
        },
        requestStartAt,
      )
      client.disconnect(true)
      return
    }

    const payload = body?.payload
    if (
      !payload ||
      !this.isPositiveInteger(payload.conversationId) ||
      typeof payload.messageId !== 'string' ||
      !DIGIT_STRING_REGEX.test(payload.messageId.trim())
    ) {
      this.emitAck(
        client,
        {
          requestId,
          code: 40001,
          message: '鏃犳晥鐨?chat.read 杞借嵎',
        },
        requestStartAt,
      )
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
      this.emitAck(
        client,
        {
          requestId,
          code: 0,
          message: 'ok',
          data: result,
        },
        requestStartAt,
      )
    } catch (error) {
      this.emitAck(
        client,
        {
          requestId,
          ...this.mapErrorToAck(error),
        },
        requestStartAt,
      )
    }
  }

  /** 鑾峰彇鐢ㄦ埛鎴块棿鍚嶇О */
  private getUserRoom(userId: number) {
    return `user:${userId}`
  }

  /** 鑾峰彇娑堟伅鑱婂ぉ鏈嶅姟瀹炰緥锛堝欢杩熷姞杞斤級 */
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

  /** 瑙ｆ瀽鐢ㄦ埛ID锛堜粠 JWT 浠ょ墝锛? */
  private async resolveUserId(client: Socket) {
    const token = this.extractToken(client)
    if (!token) {
      return null
    }

    const authConfig = this.configService.get<AuthConfigInterface>('auth')
    const publicKey = this.configService.get<string>('rsa.publicKey')
    if (!authConfig || !publicKey) {
      this.logger.warn('娑堟伅缃戝叧缂哄皯璁よ瘉閰嶇疆')
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

  /** 浠庡鎴风鎻愬彇浠ょ墝 */
  private extractToken(client: Socket) {
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

  /** 鏍囧噯鍖?Bearer 浠ょ墝 */
  private normalizeBearerToken(value: string) {
    const token = value.trim()
    if (token.startsWith('Bearer ')) {
      return token.slice(7)
    }
    return token
  }

  /** 鍙戦€佸簲绛旀秷鎭? */
  private emitAck(
    client: Socket,
    payload: WsAckPayload,
    requestStartAt?: number,
  ) {
    client.emit('chat.ack', payload)
    if (Number.isFinite(requestStartAt)) {
      const latencyMs = Math.max(0, Date.now() - Number(requestStartAt))
      this.recordAckMetric(payload.code, latencyMs)
    }
  }

  /** 鏍囧噯鍖栬姹侷D */
  private normalizeRequestId(requestId?: string) {
    if (typeof requestId !== 'string' || !requestId.trim()) {
      return undefined
    }
    return requestId.trim().slice(0, 100)
  }

  /** 鎻愬彇宸茶璇佺殑鐢ㄦ埛ID */
  private extractAuthenticatedUserId(client: Socket) {
    const userId = Number(client.data.userId)
    if (!Number.isInteger(userId) || userId <= 0) {
      return null
    }
    return userId
  }

  /** 鍒ゆ柇鏄惁涓烘鏁存暟 */
  private isPositiveInteger(value: unknown) {
    const normalized = Number(value)
    return Number.isInteger(normalized) && normalized > 0
  }

  /** 鍒ゆ柇鏄惁涓烘湁鏁堢殑娑堟伅绫诲瀷 */
  private isValidMessageType(value: unknown) {
    return (
      value === ChatMessageTypeEnum.TEXT ||
      value === ChatMessageTypeEnum.IMAGE ||
      value === ChatMessageTypeEnum.SYSTEM
    )
  }

  /** 楠岃瘉鍙戦€佹秷鎭浇鑽锋槸鍚︽湁鏁? */
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
      payload.clientMessageId !== undefined &&
      (typeof payload.clientMessageId !== 'string' ||
        !payload.clientMessageId.trim() ||
        payload.clientMessageId.trim().length > 64)
    ) {
      return false
    }
    if (
      payload.payload !== undefined &&
      (typeof payload.payload !== 'object' ||
        payload.payload === null ||
        Array.isArray(payload.payload))
    ) {
      return false
    }
    return true
  }

  /** 灏嗚浇鑽峰璞″簭鍒楀寲涓哄瓧绗︿覆 */
  private stringifyPayloadObject(payload: unknown) {
    if (payload === undefined) {
      return undefined
    }

    if (
      typeof payload !== 'object' ||
      payload === null ||
      Array.isArray(payload)
    ) {
      throw new BadRequestException('payload 蹇呴』鏄?JSON 瀵硅薄')
    }

    return JSON.stringify(payload)
  }

  /** 灏嗛敊璇槧灏勪负搴旂瓟杞借嵎 */
  private mapErrorToAck(error: unknown): Omit<WsAckPayload, 'requestId'> {
    if (error instanceof BadRequestException) {
      return {
        code: 40001,
        message: this.getErrorMessage(error, '璇锋眰鍙傛暟閿欒'),
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
      '娑堟伅缃戝叧 WebSocket 澶勭悊澶辫触',
      error instanceof Error ? error.stack : String(error),
    )
    return {
      code: 50001,
      message: '服务器内部错误',
    }
  }

  /** 浠庡紓甯镐腑鎻愬彇閿欒娑堟伅 */
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
      this.logger.warn(`璁板綍 WS 璇锋眰鐩戞帶澶辫触: ${this.stringifyError(error)}`)
    })
  }

  private recordAckMetric(code: number, latencyMs: number) {
    void this.messageWsMonitorService
      .recordAck(code, latencyMs)
      .catch((error) => {
        this.logger.warn(`璁板綍 WS ack 鐩戞帶澶辫触: ${this.stringifyError(error)}`)
      })
  }

  private recordReconnectMetric() {
    void this.messageWsMonitorService.recordReconnect().catch((error) => {
      this.logger.warn(`璁板綍 WS 杩炴帴鐩戞帶澶辫触: ${this.stringifyError(error)}`)
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
