import type { BodyToken } from '@libs/interaction/body/body-token.type'
import type { StructuredValue } from '@libs/platform/utils'
import type { ChatMessageTypeEnum } from './chat.constant'
import type { BaseChatMessageDto } from './dto/chat.dto'

/**
 * 聊天消息创建后投递到消息域事件总线的 payload。
 */
export interface ChatMessageCreatedDomainEventPayload {
  conversationId: number
  messageId: string
}

/**
 * 聊天消息统一输出结构。
 * - 复用 HTTP 消息 DTO 字段，实时推送只替换运行时载荷类型。
 */
export type ChatMessageOutput = Omit<
  BaseChatMessageDto,
  'bodyTokens' | 'payload'
> & {
  bodyTokens?: BodyToken[]
  payload?: StructuredValue
}

/**
 * 会话成员输出组装依赖的最小字段集。
 */
export interface ChatConversationMemberOutputSource {
  userId: number
  unreadCount: number
  lastReadAt: Date | null
  lastReadMessageId: bigint | null
  user: ChatConversationMemberUserSource
}

/**
 * 会话成员用户快照输出依赖的最小字段集。
 */
export interface ChatConversationMemberUserSource {
  id: number
  nickname: string | null
  avatar: string | null
}

/**
 * 会话列表最后消息内容查询依赖的最小字段集。
 */
export interface ChatMessageContentSource {
  id: bigint
  content: string
}

/**
 * 聊天消息发送边界校验的原始输入。
 */
export interface ChatMessageSendBoundaryInput {
  conversationId: unknown
  messageType: unknown
  content: unknown
  clientMessageId?: unknown
  payload?: unknown
}

/**
 * 聊天消息发送边界校验后的规范化输入。
 */
export interface NormalizedChatMessageSendInput {
  conversationId: number
  messageType: ChatMessageTypeEnum
  content: string
  clientMessageId?: string
  payloadObject?: Record<string, unknown>
  payloadJson?: string
}

/**
 * 聊天消息发送边界校验成功结果。
 */
export interface ChatMessageSendBoundarySuccess {
  ok: true
  value: NormalizedChatMessageSendInput
}

/**
 * 聊天消息发送边界校验失败结果。
 */
export interface ChatMessageSendBoundaryFailure {
  ok: false
  message: string
}

/**
 * 聊天消息发送边界校验结果。
 */
export type ChatMessageSendBoundaryResult =
  | ChatMessageSendBoundarySuccess
  | ChatMessageSendBoundaryFailure

/**
 * 客户端幂等键规范化成功结果。
 */
export interface NormalizeClientMessageIdSuccess {
  ok: true
  value?: string
}

/**
 * 客户端幂等键规范化结果。
 */
export type NormalizeClientMessageIdResult =
  | NormalizeClientMessageIdSuccess
  | ChatMessageSendBoundaryFailure

/**
 * 扩展载荷的对象与 JSON 字符串双形态。
 */
export interface NormalizedPayloadValue {
  object: Record<string, unknown>
  json: string
}

/**
 * 可选扩展载荷规范化成功结果。
 */
export interface NormalizePayloadSuccess {
  ok: true
  value?: NormalizedPayloadValue
}

/**
 * 必填扩展载荷对象规范化成功结果。
 */
export interface NormalizePayloadObjectSuccess {
  ok: true
  value: NormalizedPayloadValue
}

/**
 * 可选扩展载荷规范化结果。
 */
export type NormalizePayloadResult =
  | NormalizePayloadSuccess
  | ChatMessageSendBoundaryFailure

/**
 * 必填扩展载荷对象规范化结果。
 */
export type NormalizePayloadObjectResult =
  | NormalizePayloadObjectSuccess
  | ChatMessageSendBoundaryFailure
