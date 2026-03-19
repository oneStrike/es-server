/**
 * 论坛通知类型枚举。
 */
export enum ForumNotificationTypeEnum {
  SYSTEM = 1,
  TOPIC_REPLY = 2,
  TOPIC_LIKE = 3,
  TOPIC_FAVORITE = 4,
  TOPIC_AUDIT = 5,
  MODERATOR_APPLICATION = 6,
}

/**
 * 论坛通知优先级枚举。
 */
export enum ForumNotificationPriorityEnum {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4,
}
