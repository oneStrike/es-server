/**
 * 打开私聊会话入参。
 * targetUserId 表示要发起私聊的目标用户。
 */
export interface OpenDirectConversationInput {
  targetUserId: number
}

/**
 * 会话列表分页查询条件。
 * 仅包含分页通用字段。
 */
export interface QueryChatConversationListInput {
  pageIndex?: number
  pageSize?: number
}

/**
 * 会话消息查询条件。
 * 支持游标翻页与 afterSeq 补偿拉取。
 */
export interface QueryChatConversationMessagesInput {
  conversationId: number
  cursor?: string
  afterSeq?: string
  limit?: number
}

/**
 * 发送聊天消息入参。
 * 包含会话、消息类型、内容与可选载荷。
 */
export interface SendChatMessageInput {
  conversationId: number
  messageType: number
  content: string
  clientMessageId?: string
  payload?: string
}

/**
 * 标记会话已读入参。
 * messageId 表示已读到的消息位置。
 */
export interface MarkConversationReadInput {
  conversationId: number
  messageId: string
}
