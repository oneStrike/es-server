/** 聊天会话列表分页查询参数。 */
export interface ChatConversationListQueryInput extends Record<
  string,
  unknown
> {
  userId: number
  limit: number
  offset: number
}

/** 聊天消息第一页或无游标历史查询参数。 */
export interface ChatMessagePageQueryInput extends Record<string, unknown> {
  conversationId: number
  limit: number
}

/** 聊天消息游标向前翻页查询参数。 */
export interface ChatMessageBeforeCursorQueryInput extends ChatMessagePageQueryInput {
  cursor: bigint
}

/** 聊天消息按序号增量重同步查询参数。 */
export interface ChatMessageAfterSeqQueryInput extends ChatMessagePageQueryInput {
  afterSeq: bigint
}
