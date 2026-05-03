import type { StructuredValue } from '@libs/platform/utils'

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

/** 稳定领域类型 `NativeWsAuthResult`。原生 WS 鉴权阶段的协议映射结果。 */
export interface NativeWsAuthResult {
  userId: number | null
  code?: number
  message: string
  shouldClose: boolean
}

/** 稳定领域类型 `NativeWsRequestEnvelope`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface NativeWsRequestEnvelope<
  TPayload = object,
> extends WsRequestEnvelope<TPayload> {
  event?: string
  token?: string
}
