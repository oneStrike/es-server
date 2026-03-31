import type { AuthConfigInterface } from '@libs/platform/types'
import type { IncomingMessage } from 'node:http'
import type { Server, Socket } from 'socket.io'
import type { WebSocket } from 'ws'
import type { MessageChatService } from '../chat/chat.service'
import type {
  WsAckPayload,
  WsReadPayload,
  WsRequestEnvelope,
  WsSendPayload,
} from './notification-websocket.types'
import process from 'node:process'
import { isDevelopment } from '@libs/platform/utils'
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ModuleRef } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { ChatMessageTypeEnum, MESSAGE_CHAT_SERVICE_TOKEN } from '../chat/chat.constant'
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
  ) {}

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

  bindSocketServer(server: Server) {
    this.socketServer = server
  }

  getUserRoom(userId: number) {
    return `user:${userId}`
  }

  async resolveSocketIoUserId(client: Socket) {
    return this.authenticateToken(this.extractSocketIoToken(client))
  }

  async resolveNativeRequestUserId(request: IncomingMessage) {
    return this.authenticateToken(this.extractNativeRequestToken(request))
  }

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

  emitToUser(userId: number, event: string, payload: unknown) {
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
        this.logger.warn(`Failed to push native WS event: ${this.stringifyError(error)}`)
        this.unregisterNativeClient(userId, client)
      }
    }
  }

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

    const payload = body?.payload
    if (!payload || !this.isValidSendPayload(payload)) {
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

      return this.finishAck(
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
      return this.finishAck(
        {
          requestId,
          ...this.mapErrorToAck(error),
        },
        requestStartAt,
      )
    }
  }

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

    const payload = body?.payload
    if (
      !payload
      || !this.isPositiveInteger(payload.conversationId)
      || typeof payload.messageId !== 'string'
      || !DIGIT_STRING_REGEX.test(payload.messageId.trim())
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
      const result = await this.getMessageChatService().markConversationRead(userId, {
        conversationId: payload.conversationId,
        messageId: payload.messageId.trim(),
      })

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

  createNativeEventMessage(event: string, data?: unknown) {
    return JSON.stringify(data === undefined ? { event } : { event, data })
  }

  createNativeAckMessage(payload: WsAckPayload) {
    return JSON.stringify({
      event: 'chat.ack',
      ...payload,
    })
  }

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

  createNativeAuthRequiredMessage() {
    return this.createNativeEventMessage('ws.auth.required', {
      message: 'Authentication required',
    })
  }

  createNativeAuthOkMessage(userId: number) {
    return this.createNativeEventMessage('ws.auth.ok', { userId })
  }

  createNativeAuthErrorMessage() {
    return this.createNativeEventMessage('ws.auth.error', {
      message: 'Authentication failed',
    })
  }

  private finishAck(payload: WsAckPayload, requestStartAt: number) {
    const latencyMs = Math.max(0, Date.now() - requestStartAt)
    this.recordAckMetric(payload.code, latencyMs)
    return payload
  }

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

  private extractNativeRequestToken(request: IncomingMessage) {
    const queryToken = this.getQueryToken(request)
    if (queryToken) {
      return this.normalizeBearerToken(queryToken)
    }

    const authorization = request.headers.authorization
    if (typeof authorization === 'string' && authorization.trim()) {
      return this.normalizeBearerToken(authorization)
    }

    return null
  }

  private getQueryToken(request: IncomingMessage) {
    try {
      const host
        = typeof request.headers.host === 'string' && request.headers.host.trim()
          ? request.headers.host
          : 'localhost'
      const url = new URL(request.url ?? '/', `http://${host}`)
      const token = url.searchParams.get('token')
      return token?.trim() || null
    } catch {
      return null
    }
  }

  private normalizeBearerToken(value: string) {
    const token = value.trim()
    if (token.startsWith('Bearer ')) {
      return token.slice(7)
    }
    return token
  }

  private normalizeRequestId(requestId?: string) {
    if (typeof requestId !== 'string' || !requestId.trim()) {
      return undefined
    }
    return requestId.trim().slice(0, 100)
  }

  private isPositiveInteger(value: unknown) {
    const normalized = Number(value)
    return Number.isInteger(normalized) && normalized > 0
  }

  private isValidMessageType(value: unknown) {
    return (
      value === ChatMessageTypeEnum.TEXT
      || value === ChatMessageTypeEnum.IMAGE
      || value === ChatMessageTypeEnum.SYSTEM
    )
  }

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
      && (
        typeof payload.clientMessageId !== 'string'
        || !payload.clientMessageId.trim()
        || payload.clientMessageId.trim().length > 64
      )
    ) {
      return false
    }
    if (
      payload.payload !== undefined
      && (
        typeof payload.payload !== 'object'
        || payload.payload === null
        || Array.isArray(payload.payload)
      )
    ) {
      return false
    }
    return true
  }

  private stringifyPayloadObject(payload: unknown) {
    if (payload === undefined) {
      return undefined
    }

    if (
      typeof payload !== 'object'
      || payload === null
      || Array.isArray(payload)
    ) {
      throw new BadRequestException('payload must be a JSON object')
    }

    return JSON.stringify(payload)
  }

  private mapErrorToAck(error: unknown) {
    if (error instanceof BadRequestException) {
      return {
        code: 40001,
        message: this.getErrorMessage(error, 'Bad request'),
      }
    }

    if (error instanceof NotFoundException) {
      const message = this.getErrorMessage(error, 'Resource not found')
      return {
        code: message.toLowerCase().includes('message') ? 40402 : 40401,
        message,
      }
    }

    this.logger.error(
      'WebSocket request failed',
      error instanceof Error ? error.stack : String(error),
    )
    return {
      code: 50001,
      message: 'Internal server error',
    }
  }

  private getErrorMessage(
    error: { getResponse: () => unknown },
    fallback: string,
  ) {
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
      this.logger.warn(`Failed to record WS request metric: ${this.stringifyError(error)}`)
    })
  }

  private recordAckMetric(code: number, latencyMs: number) {
    void this.messageWsMonitorService.recordAck(code, latencyMs).catch((error) => {
      this.logger.warn(`Failed to record WS ack metric: ${this.stringifyError(error)}`)
    })
  }

  private recordReconnectMetric() {
    void this.messageWsMonitorService.recordReconnect().catch((error) => {
      this.logger.warn(`Failed to record WS reconnect metric: ${this.stringifyError(error)}`)
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
