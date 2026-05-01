import type { UserNotificationSelect } from '@db/schema'

/** inbox 最新聊天摘要，供消息中心聚合响应复用。 */
export interface InboxLatestChatSummary {
  conversationId: number
  lastMessageId?: string
  lastMessageAt?: Date
  lastMessageContent?: string
  lastSenderId?: number
}

/** 原生 SQL 查询结果行容器。 */
export type InboxRawRowsResult<T> =
  | {
      rows?: T[] | null
    }
    | object
    | null
    | undefined

/** inbox timeline 原生 SQL 返回行。 */
export interface InboxTimelineRawRow {
  sourceType: 'notification' | 'chat'
  createdAt: Date
  title: string
  content: string | null
  bizId: string
}

/** 最新通知摘要查询返回行。 */
export type InboxLatestNotificationRow = Pick<
  UserNotificationSelect,
  'id' | 'categoryKey' | 'title' | 'content' | 'createdAt' | 'expiresAt'
>

/** inbox 用户与时间窗口查询参数。 */
export interface InboxUserTimeQueryInput extends Record<string, unknown> {
  userId: number
  now: Date
}

/** inbox 用户查询参数。 */
export interface InboxUserQueryInput extends Record<string, unknown> {
  userId: number
}

/** inbox 最后一条消息内容查询参数。 */
export interface InboxLatestChatMessageQueryInput extends Record<
  string,
  unknown
> {
  messageId: bigint
}
