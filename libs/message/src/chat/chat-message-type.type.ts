import type { CHAT_SENDABLE_MESSAGE_TYPES } from './chat.constant'

/** 客户端可发送消息类型的闭集字面量类型。 */
export type ChatSendMessageType = (typeof CHAT_SENDABLE_MESSAGE_TYPES)[number]
