import type { StructuredValue } from '@libs/platform/utils'

import type { Buffer } from 'node:buffer'

/** 稳定领域类型 `WsRequestEnvelope`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface WsRequestEnvelope<TPayload> {
  requestId?: string
  timestamp?: number
  payload?: TPayload
}

/** 稳定领域类型 `WsSendPayload`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface WsSendPayload {
  conversationId: number
  clientMessageId?: string
  messageType: number
  content: string
  payload?: StructuredValue
}

/** 稳定领域类型 `WsReadPayload`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface WsReadPayload {
  conversationId: number
  messageId: string
}

/** 稳定领域类型 `WsAckPayload`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface WsAckPayload {
  requestId: string | null
  code: number
  message: string
  data?: StructuredValue
}

/** 原生 ws auth 事件载荷，供 Nest WsAdapter gateway 与服务层复用。 */
export interface WsAuthPayload {
  token?: string
}

/** 稳定领域类型 `NativeWsAuthResult`。原生 WS 鉴权阶段的协议映射结果。 */
export interface NativeWsAuthResult {
  userId: number | null
  code?: number
  message: string
  shouldClose: boolean
}

/** 原生 ws 连接状态，仅由 MessageWebSocketService 维护。 */
export interface NativeWsClientState {
  userId: number | null
}

/** 原生 ws gateway 发送结果，包含帧文本和是否需要断开连接。 */
export interface NativeWsGatewaySendResult {
  message: string
  shouldClose: boolean
}

/** 原生 ws adapter 客户端最小发送能力。 */
export interface NativeWsAdapterClient {
  readyState?: number
  send: (data: string) => void
}

/** 原生 ws adapter 从 EventTarget 收到的 message 事件。 */
export interface NativeWsAdapterMessageEvent {
  data: string | Buffer | ArrayBuffer | Buffer[]
  target?: NativeWsAdapterClient
}

/** 原生 ws adapter 从 EventEmitter 收到的 message 元组。 */
export type NativeWsAdapterMessageTuple = [
  string | Buffer | ArrayBuffer | Buffer[],
  boolean?,
]

/** 原生 ws adapter 归一化后的入站消息。 */
export interface NativeWsAdapterMessage {
  event: string
  data?: unknown
}
