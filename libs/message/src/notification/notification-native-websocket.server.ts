import type { Server as HttpServer, IncomingMessage } from 'node:http'
import type { Socket as NodeSocket } from 'node:net'
import type { WebSocket } from 'ws'
import type {
  NativeWsRequestEnvelope,
  WsReadPayload,
  WsSendPayload,
} from './notification-websocket.type'
import { Buffer } from 'node:buffer'
import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common'
import { WebSocketServer } from 'ws'
import { MessageWebSocketService } from './notification-websocket.service'

interface NativeWsClientState {
  userId: number | null
}

@Injectable()
export class MessageNativeWebSocketServer implements OnApplicationShutdown {
  private readonly logger = new Logger(MessageNativeWebSocketServer.name)

  private httpServer?: HttpServer
  private wsServer?: WebSocketServer
  private upgradeListener?: (
    request: IncomingMessage,
    socket: NodeSocket,
    head: Buffer,
  ) => void

  constructor(
    private readonly messageWebSocketService: MessageWebSocketService,
  ) {}

  attach(server: HttpServer) {
    if (this.httpServer === server) {
      return
    }

    this.close()

    this.httpServer = server
    this.wsServer = new WebSocketServer({ noServer: true })
    this.wsServer.on('connection', (client, request) => {
      void this.handleConnection(client, request)
    })

    this.upgradeListener = (request, socket, head) => {
      if (!this.isMessagePath(request)) {
        return
      }

      this.wsServer?.handleUpgrade(request, socket, head, (client) => {
        this.wsServer?.emit('connection', client, request)
      })
    }

    server.on('upgrade', this.upgradeListener)
  }

  onApplicationShutdown() {
    this.close()
  }

  private async handleConnection(client: WebSocket, request: IncomingMessage) {
    const state: NativeWsClientState = { userId: null }

    const initialAuthPromise = (async () => {
      const authResult =
        await this.messageWebSocketService.resolveNativeRequestAuth(request)
      if (authResult.userId) {
        this.bindNativeUser(state, client, authResult.userId)
        return
      }

      if (authResult.code) {
        client.send(
          this.messageWebSocketService.createNativeAuthErrorMessage(
            authResult.code,
            authResult.message,
          ),
        )
        if (authResult.shouldClose) {
          this.closeClient(state, client)
        }
        return
      }

      client.send(
        this.messageWebSocketService.createNativeAuthRequiredMessage(),
      )
    })()

    client.on('message', (raw, isBinary) => {
      void (async () => {
        if (isBinary) {
          client.send(
            this.messageWebSocketService.createNativeErrorMessage(
              40001,
              'Binary frames are not supported',
            ),
          )
          return
        }

        await initialAuthPromise
        await this.handleMessage(client, state, raw.toString())
      })()
    })

    client.on('close', () => {
      if (state.userId) {
        this.messageWebSocketService.unregisterNativeClient(
          state.userId,
          client,
        )
      }
    })

    client.on('error', (error) => {
      this.logger.warn(`Native WS connection error: ${error.message}`)
    })
  }

  private async handleMessage(
    client: WebSocket,
    state: NativeWsClientState,
    rawMessage: string,
  ) {
    let envelope: NativeWsRequestEnvelope
    try {
      envelope = JSON.parse(rawMessage) as NativeWsRequestEnvelope
    } catch {
      client.send(
        this.messageWebSocketService.createNativeErrorMessage(
          40001,
          'Message must be valid JSON',
        ),
      )
      return
    }

    const event =
      typeof envelope.event === 'string' ? envelope.event.trim() : ''
    if (!event) {
      client.send(
        this.messageWebSocketService.createNativeErrorMessage(
          40001,
          'event is required',
          this.normalizeRequestId(envelope.requestId),
        ),
      )
      return
    }

    if (event === 'auth') {
      const token = this.extractAuthToken(envelope)
      const authResult =
        await this.messageWebSocketService.resolveNativeAuthToken(token)
      if (!authResult.userId) {
        if (authResult.shouldClose) {
          this.unbindNativeUser(state, client)
        }
        client.send(
          this.messageWebSocketService.createNativeAuthErrorMessage(
            authResult.code ?? 40101,
            authResult.message,
          ),
        )
        if (authResult.shouldClose) {
          this.closeClient(state, client)
        }
        return
      }

      this.bindNativeUser(state, client, authResult.userId)
      return
    }

    if (event === 'ping') {
      client.send(this.messageWebSocketService.createNativeEventMessage('pong'))
      return
    }

    if (!state.userId) {
      client.send(
        this.messageWebSocketService.createNativeErrorMessage(
          40101,
          'Authentication required',
          this.normalizeRequestId(envelope.requestId),
        ),
      )
      return
    }

    if (event === 'chat.send') {
      const ack = await this.messageWebSocketService.handleChatSend(
        state.userId,
        envelope as NativeWsRequestEnvelope<WsSendPayload>,
      )
      client.send(this.messageWebSocketService.createNativeAckMessage(ack))
      if (this.messageWebSocketService.shouldDisconnectAfterAck(ack)) {
        this.closeClient(state, client)
      }
      return
    }

    if (event === 'chat.read') {
      const ack = await this.messageWebSocketService.handleChatRead(
        state.userId,
        envelope as NativeWsRequestEnvelope<WsReadPayload>,
      )
      client.send(this.messageWebSocketService.createNativeAckMessage(ack))
      if (this.messageWebSocketService.shouldDisconnectAfterAck(ack)) {
        this.closeClient(state, client)
      }
      return
    }

    client.send(
      this.messageWebSocketService.createNativeErrorMessage(
        40004,
        `Unsupported event: ${event}`,
        this.normalizeRequestId(envelope.requestId),
      ),
    )
  }

  // 绑定原生 WS 连接到指定用户，并在切换身份时清理旧绑定。
  private bindNativeUser(
    state: NativeWsClientState,
    client: WebSocket,
    userId: number,
  ) {
    if (state.userId === userId) {
      return
    }

    this.unbindNativeUser(state, client)

    state.userId = userId
    this.messageWebSocketService.registerNativeClient(userId, client)
    client.send(this.messageWebSocketService.createNativeAuthOkMessage(userId))
  }

  // 解除原生 WS 连接上的用户绑定。
  private unbindNativeUser(state: NativeWsClientState, client: WebSocket) {
    if (!state.userId) {
      return
    }

    this.messageWebSocketService.unregisterNativeClient(state.userId, client)
    state.userId = null
  }

  // 主动关闭原生 WS 客户端前先回收用户连接映射。
  private closeClient(state: NativeWsClientState, client: WebSocket) {
    this.unbindNativeUser(state, client)
    client.close()
  }

  // 从原生 WS auth 事件信封中提取 token。
  private extractAuthToken(envelope: NativeWsRequestEnvelope) {
    if (typeof envelope.token === 'string' && envelope.token.trim()) {
      return envelope.token.trim()
    }

    if (
      envelope.payload &&
      typeof envelope.payload === 'object' &&
      !Array.isArray(envelope.payload) &&
      'token' in envelope.payload
    ) {
      const token = (envelope.payload as { token?: string | null }).token
      if (typeof token === 'string' && token.trim()) {
        return token.trim()
      }
    }

    return null
  }

  // 判断 HTTP upgrade 请求是否属于消息 WS 入口。
  private isMessagePath(request: IncomingMessage) {
    try {
      const host =
        typeof request.headers.host === 'string' && request.headers.host.trim()
          ? request.headers.host
          : 'localhost'
      const url = new URL(request.url ?? '/', `http://${host}`)
      return url.pathname === '/message'
    } catch {
      return false
    }
  }

  // 标准化原生 WS 请求 ID。
  private normalizeRequestId(requestId?: string) {
    if (typeof requestId !== 'string' || !requestId.trim()) {
      return null
    }

    return requestId.trim().slice(0, 100)
  }

  // 关闭 WS server 并移除 HTTP upgrade 监听。
  private close() {
    if (this.httpServer && this.upgradeListener) {
      this.httpServer.off('upgrade', this.upgradeListener)
    }

    this.upgradeListener = undefined
    this.httpServer = undefined

    if (this.wsServer) {
      this.wsServer.close()
      this.wsServer = undefined
    }
  }
}
