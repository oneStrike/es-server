/**
 * 消息通知类型枚举
 * 统一使用 SmallInt 存储
 */
export enum MessageNotificationTypeEnum {
  /** 评论回复通知 */
  COMMENT_REPLY = 1,
  /** 评论点赞通知 */
  COMMENT_LIKE = 2,
  /** 内容收藏通知 */
  CONTENT_FAVORITE = 3,
  /** 用户关注通知 */
  USER_FOLLOW = 4,
  /** 系统公告通知 */
  SYSTEM_ANNOUNCEMENT = 5,
  /** 聊天消息通知 */
  CHAT_MESSAGE = 6,
}

/**
 * 通知主体类型枚举
 * 统一使用 SmallInt 存储
 */
export enum MessageNotificationSubjectTypeEnum {
  /** 评论 */
  COMMENT = 1,
  /** 作品 */
  WORK = 2,
  /** 用户 */
  USER = 3,
  /** 系统 */
  SYSTEM = 4,
}
