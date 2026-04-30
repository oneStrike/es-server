/**
 * 聊天消息创建后投递到消息域事件总线的 payload。
 */
export interface ChatMessageCreatedDomainEventPayload {
  conversationId: number
  messageId: string
}
