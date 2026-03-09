export interface WsRequestEnvelope<TPayload> {
  requestId?: string
  timestamp?: number
  payload?: TPayload
}

export interface WsSendPayload {
  conversationId: number
  clientMessageId?: string
  messageType: number
  content: string
  payload?: unknown
}

export interface WsReadPayload {
  conversationId: number
  messageId: string
}

export interface WsAckPayload {
  requestId: string | null
  code: number
  message: string
  data?: unknown
}

export interface NativeWsRequestEnvelope<TPayload = unknown>
  extends WsRequestEnvelope<TPayload> {
  event?: string
  token?: string
}
