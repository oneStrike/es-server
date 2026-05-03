import type { ServerOptions, WebSocket } from 'ws'
import type {
  WsAuthPayload,
  WsReadPayload,
  WsRequestEnvelope,
  WsSendPayload,
} from './notification-websocket.type'
import process from 'node:process'
import { isDevelopment } from '@libs/platform/utils'
import { Injectable } from '@nestjs/common'
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets'
import { MessageWebSocketService } from './notification-websocket.service'

const MESSAGE_WS_CORS_ORIGINS_ENV = 'MESSAGE_WS_CORS_ORIGINS'

// 读取消息 WS 来源白名单；空配置在生产环境默认拒绝跨站握手。
function getMessageWsAllowedOrigins(): string[] {
  return (process.env[MESSAGE_WS_CORS_ORIGINS_ENV] || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

// 判断 native ws 握手 Origin 是否允许，保持原 Socket.IO CORS 语义。
function isMessageWsOriginAllowed(origin?: string): boolean {
  const allowedOrigins = getMessageWsAllowedOrigins()
  if (allowedOrigins.includes('*')) {
    return true
  }

  if (!allowedOrigins.length) {
    return !!isDevelopment()
  }

  return typeof origin === 'string' && allowedOrigins.includes(origin)
}

const messageWsVerifyClient: ServerOptions['verifyClient'] =
  function verifyMessageWsClient(info): boolean {
    return isMessageWsOriginAllowed(info.origin)
  }

@Injectable()
@WebSocketGateway({ path: '/message', verifyClient: messageWsVerifyClient })
export class MessageGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly messageWebSocketService: MessageWebSocketService,
  ) {}

  // 建立 native ws 连接后先进入未鉴权状态，浏览器客户端随后发送 auth 事件。
  handleConnection(client: WebSocket) {
    this.messageWebSocketService.initializeNativeClient(client)
    client.send(this.messageWebSocketService.createNativeAuthRequiredMessage())
  }

  // 连接关闭时回收 service 中维护的用户连接索引。
  handleDisconnect(client: WebSocket) {
    this.messageWebSocketService.unregisterNativeClient(client)
  }

  @SubscribeMessage('auth')
  async handleAuth(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() body: WsAuthPayload,
  ) {
    const result = await this.messageWebSocketService.authenticateNativeClient(
      client,
      body,
    )
    client.send(result.message)
    if (result.shouldClose) {
      client.close()
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: WebSocket) {
    client.send(this.messageWebSocketService.createNativeEventMessage('pong'))
  }

  @SubscribeMessage('chat.send')
  async handleChatSend(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() body: WsRequestEnvelope<WsSendPayload>,
  ) {
    const ack = await this.messageWebSocketService.handleChatSend(
      this.messageWebSocketService.getNativeClientUserId(client),
      body,
    )
    client.send(this.messageWebSocketService.createNativeAckMessage(ack))
    if (this.messageWebSocketService.shouldDisconnectAfterAck(ack)) {
      client.close()
    }
  }

  @SubscribeMessage('chat.read')
  async handleChatRead(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() body: WsRequestEnvelope<WsReadPayload>,
  ) {
    const ack = await this.messageWebSocketService.handleChatRead(
      this.messageWebSocketService.getNativeClientUserId(client),
      body,
    )
    client.send(this.messageWebSocketService.createNativeAckMessage(ack))
    if (this.messageWebSocketService.shouldDisconnectAfterAck(ack)) {
      client.close()
    }
  }
}
