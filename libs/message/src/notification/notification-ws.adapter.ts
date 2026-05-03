import type { MessageMappingProperties } from '@nestjs/websockets/gateway-metadata-explorer'
import type { Observable } from 'rxjs'
import type {
  NativeWsAdapterClient,
  NativeWsAdapterMessage,
  NativeWsAdapterMessageEvent,
  NativeWsAdapterMessageTuple,
} from './notification-websocket.type'
import { Buffer } from 'node:buffer'
import { WsAdapter } from '@nestjs/platform-ws'
import { EMPTY, fromEvent } from 'rxjs'
import { filter, first, mergeMap, share, takeUntil } from 'rxjs/operators'

const NATIVE_WS_OPEN = 1
type NativeWsAdapterIncomingMessage =
  | NativeWsAdapterMessageEvent
  | NativeWsAdapterMessageTuple
type NativeWsAdapterMessageData = NativeWsAdapterMessageTuple[0]

export class MessageWsAdapter extends WsAdapter {
  // 绑定 native ws 消息处理器，并把协议层解析失败显式转成 ws.error。
  override bindMessageHandlers(
    client: NativeWsAdapterClient,
    handlers: MessageMappingProperties[],
    transform: (data: unknown) => Observable<unknown>,
  ) {
    const handlersMap = new Map<string, MessageMappingProperties>()
    handlers.forEach((handler) => {
      handlersMap.set(String(handler.message), handler)
    })

    const close$ = fromEvent(client as never, 'close').pipe(share(), first())
    const source$ = fromEvent(
      client as never,
      'message',
      (...args: unknown[]) => this.normalizeMessageEventArgs(args),
    ).pipe(
      mergeMap((message) =>
        this.bindMessageHandlerForClient(
          client,
          message,
          handlersMap,
          transform,
        ).pipe(filter((result) => result !== undefined && result !== null)),
      ),
      takeUntil(close$),
    )

    source$.subscribe((response) => {
      if (client.readyState !== NATIVE_WS_OPEN) {
        return
      }

      client.send(JSON.stringify(response))
    })
  }

  // 解析单条入站消息，并将 unsupported event 也纳入协议错误帧。
  private bindMessageHandlerForClient(
    client: NativeWsAdapterClient,
    rawMessage: NativeWsAdapterMessageEvent | NativeWsAdapterMessageTuple,
    handlersMap: Map<string, MessageMappingProperties>,
    transform: (data: unknown) => Observable<unknown>,
  ): Observable<unknown> {
    const message = this.parseMessage(client, rawMessage)
    if (!message) {
      return EMPTY
    }

    const messageHandler = handlersMap.get(message.event)
    if (!messageHandler) {
      this.sendProtocolError(
        client,
        40004,
        `Unsupported event: ${message.event}`,
        this.extractRequestId(message.data),
      )
      return EMPTY
    }

    return transform(messageHandler.callback(message.data, message.event))
  }

  // 将 ws EventTarget / EventEmitter 两种 message 形态归一成业务帧。
  private parseMessage(
    client: NativeWsAdapterClient,
    rawMessage: NativeWsAdapterIncomingMessage,
  ): NativeWsAdapterMessage | null {
    const { data, isBinary } = this.normalizeRawMessage(rawMessage)
    if (isBinary || typeof data !== 'string') {
      this.sendProtocolError(client, 40001, 'Binary frames are not supported')
      return null
    }

    try {
      const message = this.messageParser(data) as NativeWsAdapterMessage | void
      let event = ''
      if (typeof message?.event === 'string') {
        event = message.event.trim()
      }

      if (!event) {
        this.sendProtocolError(
          client,
          40001,
          'event is required',
          this.extractRequestId(message?.data),
        )
        return null
      }

      return {
        event,
        data: message?.data,
      }
    } catch {
      this.sendProtocolError(client, 40001, 'Message must be valid JSON')
      return null
    }
  }

  // 保留 ws EventEmitter 的第二个 isBinary 参数，避免文本 Buffer 被误判。
  private normalizeMessageEventArgs(
    args: unknown[],
  ): NativeWsAdapterIncomingMessage {
    if (args.length > 1) {
      return [
        args[0] as NativeWsAdapterMessageData,
        args[1] === true,
      ]
    }

    return args[0] as NativeWsAdapterMessageEvent
  }

  // 兼容 Node EventEmitter 测试夹具与 ws EventTarget 运行时事件。
  private normalizeRawMessage(
    rawMessage: NativeWsAdapterIncomingMessage,
  ) {
    if (Array.isArray(rawMessage)) {
      return this.normalizeMessageData(rawMessage[0], rawMessage[1] === true)
    }

    if (this.isNativeMessageEvent(rawMessage)) {
      return this.normalizeMessageData(
        rawMessage.data,
        typeof rawMessage.data !== 'string',
      )
    }

    return this.normalizeMessageData(
      rawMessage as NativeWsAdapterMessageData,
      false,
    )
  }

  private isNativeMessageEvent(
    value: NativeWsAdapterIncomingMessage,
  ): value is NativeWsAdapterMessageEvent {
    return typeof value === 'object' && value !== null && 'data' in value
  }

  private normalizeMessageData(
    data: NativeWsAdapterMessageData,
    isBinary: boolean,
  ) {
    if (isBinary) {
      return { data, isBinary: true }
    }

    if (typeof data === 'string') {
      return { data, isBinary: false }
    }

    if (Buffer.isBuffer(data)) {
      return { data: data.toString('utf8'), isBinary: false }
    }

    if (data instanceof ArrayBuffer) {
      return { data: Buffer.from(data).toString('utf8'), isBinary: false }
    }

    if (Array.isArray(data)) {
      return { data: Buffer.concat(data).toString('utf8'), isBinary: false }
    }

    return { data, isBinary: true }
  }

  // 从 canonical data 中提取 requestId，避免协议错误丢失客户端关联 ID。
  private extractRequestId(data: unknown): string | null {
    if (typeof data !== 'object' || data === null || !('requestId' in data)) {
      return null
    }

    const requestId = (data as { requestId?: unknown }).requestId
    if (typeof requestId !== 'string') {
      return null
    }

    const normalizedRequestId = requestId.trim()
    if (!normalizedRequestId) {
      return null
    }

    return normalizedRequestId.slice(0, 100)
  }

  // 发送统一 ws.error 帧，保持协议层错误对客户端可见。
  private sendProtocolError(
    client: NativeWsAdapterClient,
    code: number,
    message: string,
    requestId: string | null = null,
  ) {
    if (client.readyState !== NATIVE_WS_OPEN) {
      return
    }

    client.send(
      JSON.stringify({
        event: 'ws.error',
        data: {
          requestId,
          code,
          message,
        },
      }),
    )
  }
}
