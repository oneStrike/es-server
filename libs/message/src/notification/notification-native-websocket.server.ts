import type { Server as HttpServer, IncomingMessage } from 'node:http'
import type { Socket as NodeSocket } from 'node:net'
import type { WebSocket } from 'ws'
import type { NativeWsRequestEnvelope } from './notification-websocket.types'
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

    const bindUser = (userId: number) => {
      if (state.userId === userId) {
        return
      }

      if (state.userId) {
        this.messageWebSocketService.unregisterNativeClient(
          state.userId,
          client,
        )
      }

      state.userId = userId
      this.messageWebSocketService.registerNativeClient(userId, client)
      client.send(
        this.messageWebSocketService.createNativeAuthOkMessage(userId),
      )
    }

    const initialAuthPromise = (async () => {
      const userId =
        await this.messageWebSocketService.resolveNativeRequestUserId(request)
      if (userId) {
        bindUser(userId)
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
      const userId = await this.messageWebSocketService.authenticateToken(token)
      if (!userId) {
        client.send(this.messageWebSocketService.createNativeAuthErrorMessage())
        return
      }

      if (state.userId && state.userId !== userId) {
        this.messageWebSocketService.unregisterNativeClient(
          state.userId,
          client,
        )
      }

      state.userId = userId
      this.messageWebSocketService.registerNativeClient(userId, client)
      client.send(
        this.messageWebSocketService.createNativeAuthOkMessage(userId),
      )
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
        envelope as NativeWsRequestEnvelope<
          import('./notification-websocket.types').WsSendPayload
        >,
      )
      client.send(this.messageWebSocketService.createNativeAckMessage(ack))
      return
    }

    if (event === 'chat.read') {
      const ack = await this.messageWebSocketService.handleChatRead(
        state.userId,
        envelope as NativeWsRequestEnvelope<
          import('./notification-websocket.types').WsReadPayload
        >,
      )
      client.send(this.messageWebSocketService.createNativeAckMessage(ack))
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

  private normalizeRequestId(requestId?: string) {
    if (typeof requestId !== 'string' || !requestId.trim()) {
      return null
    }

    return requestId.trim().slice(0, 100)
  }

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
