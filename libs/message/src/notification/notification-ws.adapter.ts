import type { MessageMappingProperties } from '@nestjs/websockets/gateway-metadata-explorer'
import type { Observable } from 'rxjs'
import type {
  NativeWsAdapterClient,
  NativeWsAdapterMessage,
  NativeWsAdapterMessageEvent,
  NativeWsAdapterMessageTuple,
} from './notification-websocket.type'
import { WsAdapter } from '@nestjs/platform-ws'
import { EMPTY, fromEvent } from 'rxjs'
import { filter, first, mergeMap, share, takeUntil } from 'rxjs/operators'

const NATIVE_WS_OPEN = 1

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
    const source$ = fromEvent(client as never, 'message').pipe(
      mergeMap((message) =>
        this.bindMessageHandlerForClient(
          client,
          message as NativeWsAdapterMessageEvent | NativeWsAdapterMessageTuple,
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
  ) {
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
    rawMessage: NativeWsAdapterMessageEvent | NativeWsAdapterMessageTuple,
  ): NativeWsAdapterMessage | null {
    const { data, isBinary } = this.normalizeRawMessage(rawMessage)
    if (isBinary || typeof data !== 'string') {
      this.sendProtocolError(client, 40001, 'Binary frames are not supported')
      return null
    }

    try {
      const message = this.messageParser(data) as NativeWsAdapterMessage | void
      const event =
        typeof message?.event === 'string' ? message.event.trim() : ''
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

  // 兼容 Node EventEmitter 测试夹具与 ws EventTarget 运行时事件。
  private normalizeRawMessage(
    rawMessage: NativeWsAdapterMessageEvent | NativeWsAdapterMessageTuple,
  ) {
    if (Array.isArray(rawMessage)) {
      return {
        data: rawMessage[0],
        isBinary: rawMessage[1] === true,
      }
    }

    return {
      data: rawMessage.data,
      isBinary: typeof rawMessage.data !== 'string',
    }
  }

  // 从 canonical data 中提取 requestId，避免协议错误丢失客户端关联 ID。
  private extractRequestId(data: unknown) {
    if (typeof data !== 'object' || data === null || !('requestId' in data)) {
      return null
    }

    const requestId = (data as { requestId?: unknown }).requestId
    return typeof requestId === 'string' && requestId.trim()
      ? requestId.trim().slice(0, 100)
      : null
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
