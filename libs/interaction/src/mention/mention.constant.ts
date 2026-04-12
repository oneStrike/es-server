/**
 * 提及来源类型枚举。
 * 当前仅支持评论和论坛主题两类正文。
 */
export enum MentionSourceTypeEnum {
  /** 评论 */
  COMMENT = 1,
  /** 论坛主题 */
  FORUM_TOPIC = 2,
}
