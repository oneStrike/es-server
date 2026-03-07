/**
 * 消息通知类型枚举
 * 定义系统支持的通知类型
 */
export enum MessageNotificationTypeEnum {
  /** 评论回复通知 */
  COMMENT_REPLY = 'COMMENT_REPLY',
  /** 评论点赞通知 */
  COMMENT_LIKE = 'COMMENT_LIKE',
  /** 内容收藏通知 */
  CONTENT_FAVORITE = 'CONTENT_FAVORITE',
  /** 用户关注通知 */
  USER_FOLLOW = 'USER_FOLLOW',
  /** 系统公告通知 */
  SYSTEM_ANNOUNCEMENT = 'SYSTEM_ANNOUNCEMENT',
  /** 聊天消息通知 */
  CHAT_MESSAGE = 'CHAT_MESSAGE',
}
