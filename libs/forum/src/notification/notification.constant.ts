/**
 * 通知模块常量定义
 */

/// 通知优先级枚举
export enum NotificationPriorityEnum {
  /** 普通 */
  NORMAL = 1,
  /** 重要 */
  IMPORTANT = 2,
}

/// 通知类型枚举
export enum NotificationTypeEnum {
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
export const NotificationTitleTemplates = {
  [NotificationTypeEnum.REPLY]: '有人回复了你的主题',
  [NotificationTypeEnum.LIKE]: '有人赞了你的内容',
  [NotificationTypeEnum.FAVORITE]: '有人收藏了你的主题',
  [NotificationTypeEnum.SYSTEM]: '系统通知',
}

/// 通知内容模板
export const NotificationContentTemplates = {
  [NotificationTypeEnum.REPLY]: (userName: string, topicTitle: string) =>
    `${userName} 回复了你的主题《${topicTitle}》`,
  [NotificationTypeEnum.LIKE]: (userName: string, objectType: string) =>
    `${userName} 赞了你的${objectType}`,
  [NotificationTypeEnum.FAVORITE]: (userName: string, topicTitle: string) =>
    `${userName} 收藏了你的主题《${topicTitle}》`,
  [NotificationTypeEnum.SYSTEM]: (content: string) => content,
}
