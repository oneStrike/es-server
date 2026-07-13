/**
 * 会话消息游标签名绑定的身份范围，确保游标不能跨用户或会话重放。
 */
export interface ChatMessageCursorScope {
  authenticatedUserId: number
  conversationId: number
}

/**
 * 编码会话消息游标时所需的边界序号与身份范围。
 */
export interface EncodeChatMessageCursorInput extends ChatMessageCursorScope {
  boundaryMessageSeq: bigint
}

/**
 * 解码会话消息游标时所需的原始游标与身份范围。
 */
export interface DecodeChatMessageCursorInput extends ChatMessageCursorScope {
  cursor: string
}

/**
 * 游标可见 payload 的闭集结构，只承载分页边界而不泄露查询范围。
 */
export interface ChatMessageCursorPayload {
  boundaryMessageSeq: string
}
