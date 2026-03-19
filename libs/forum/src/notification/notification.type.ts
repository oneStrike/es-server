import type { ForumNotification } from '@db/schema'

/**
 * 创建论坛通知的领域输入。
 */
export type CreateForumNotificationInput = Pick<
  ForumNotification,
  'userId' | 'type' | 'title' | 'content'
> &
Partial<
    Pick<
      ForumNotification,
      'topicId' | 'replyId' | 'priority' | 'expiredAt'
    >
  >

/**
 * 管理端查询论坛通知的条件。
 */
export interface QueryForumNotificationInput {
  userId?: number
  topicId?: number
  type?: number
  isRead?: boolean
  pageIndex?: number
  pageSize?: number
  orderBy?: string
}

/**
 * 用户侧查询论坛通知的条件。
 */
export interface QueryUserForumNotificationInput {
  type?: number
  isRead?: boolean
  pageIndex?: number
  pageSize?: number
  orderBy?: string
}
