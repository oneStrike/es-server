/**
 * 通知模块常量定义
 */

/// 通知优先级枚举
export enum ForumNotificationPriorityEnum {
  /** 普通 */
  NORMAL = 1,
  /** 重要 */
  IMPORTANT = 2,
}

/// 通知类型枚举
export enum ForumNotificationTypeEnum {
  /** 回复通知 */
  REPLY = 1,
  /** 点赞通知 */
  LIKE = 2,
  /** 收藏通知 */
  FAVORITE = 3,
  /** 系统通知 */
  SYSTEM = 4,
}

/// 通知标题模板
export const ForumNotificationTitleTemplates = {
  /** 回复通知标题 */
  [ForumNotificationTypeEnum.REPLY]: '有人回复了你的主题',
  /** 点赞通知标题 */
  [ForumNotificationTypeEnum.LIKE]: '有人赞了你的内容',
  /** 收藏通知标题 */
  [ForumNotificationTypeEnum.FAVORITE]: '有人收藏了你的主题',
  /** 系统通知标题 */
  [ForumNotificationTypeEnum.SYSTEM]: '系统通知',
}

/// 通知内容模板
export const NotificationContentTemplates = {
  /** 回复通知内容 */
  [ForumNotificationTypeEnum.REPLY]: (userName: string, topicTitle: string) =>
    `${userName} 回复了你的主题《${topicTitle}》`,
  /** 点赞通知内容 */
  [ForumNotificationTypeEnum.LIKE]: (userName: string, objectType: string) =>
    `${userName} 赞了你的${objectType}`,
  /** 收藏通知内容 */
  [ForumNotificationTypeEnum.FAVORITE]: (
    userName: string,
    topicTitle: string,
  ) => `${userName} 收藏了你的主题《${topicTitle}》`,
  /** 系统通知内容 */
  [ForumNotificationTypeEnum.SYSTEM]: (content: string) => content,
}
