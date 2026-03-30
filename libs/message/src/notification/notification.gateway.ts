import type { Server, Socket } from 'socket.io'
import type {
  WsReadPayload,
  WsRequestEnvelope,
  WsSendPayload,
} from './notification-websocket.types'
import process from 'node:process'
import { isDevelopment } from '@libs/platform/utils'
import { Injectable } from '@nestjs/common'
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets'
import { MessageWebSocketService } from './notification-websocket.service'

const MESSAGE_WS_CORS_ORIGINS = (process.env.MESSAGE_WS_CORS_ORIGINS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

const MESSAGE_WS_CORS_ORIGIN =
  MESSAGE_WS_CORS_ORIGINS.length > 0
    ? MESSAGE_WS_CORS_ORIGINS.includes('*')
      ? true
      : MESSAGE_WS_CORS_ORIGINS
    : !!isDevelopment()

@Injectable()
@WebSocketGateway({
  namespace: '/message',
  cors: {
    origin: MESSAGE_WS_CORS_ORIGIN,
    credentials: MESSAGE_WS_CORS_ORIGIN !== false,
  },
})
export class MessageGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly messageWebSocketService: MessageWebSocketService,
  ) {}

  afterInit(server: Server) {
    this.messageWebSocketService.bindSocketServer(server)
  }

  async handleConnection(client: Socket) {
    const userId =
      await this.messageWebSocketService.resolveSocketIoUserId(client)
    if (!userId) {
      client.disconnect(true)
      return
    }

    client.data.userId = userId
    void client.join(this.messageWebSocketService.getUserRoom(userId))
  }

  handleDisconnect(client: Socket) {
    const userId = Number(client.data.userId)
    if (!Number.isInteger(userId) || userId <= 0) {
      return
    }

    void client.leave(this.messageWebSocketService.getUserRoom(userId))
  }

  @SubscribeMessage('chat.send')
  async handleChatSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: WsRequestEnvelope<WsSendPayload>,
  ) {
    const ack = await this.messageWebSocketService.handleChatSend(
      this.extractAuthenticatedUserId(client),
      body,
    )
    client.emit('chat.ack', ack)
    if (ack.code === 40101) {
      client.disconnect(true)
    }
  }

  @SubscribeMessage('chat.read')
  async handleChatRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: WsRequestEnvelope<WsReadPayload>,
  ) {
    const ack = await this.messageWebSocketService.handleChatRead(
      this.extractAuthenticatedUserId(client),
      body,
    )
    client.emit('chat.ack', ack)
    if (ack.code === 40101) {
      client.disconnect(true)
    }
  }

  private extractAuthenticatedUserId(client: Socket) {
    const userId = Number(client.data.userId)
    if (!Number.isInteger(userId) || userId <= 0) {
      return null
    }

    return userId
  }
}
