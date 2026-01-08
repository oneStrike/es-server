/**
 * 举报类型枚举
 */
export enum ForumReportTypeEnum {
  /** 主题举报 */
  TOPIC = 'topic',
  /** 回复举报 */
  REPLY = 'reply',
  /** 用户举报 */
  USER = 'user',
}

/**
 * 举报状态枚举
 */
export enum ForumReportStatusEnum {
  /** 待处理 */
  PENDING = 'pending',
  /** 处理中 */
  PROCESSING = 'processing',
  /** 已解决 */
  RESOLVED = 'resolved',
  /** 已驳回 */
  REJECTED = 'rejected',
}

/**
 * 举报原因枚举
 */
export enum ForumReportReasonEnum {
  /** 垃圾信息 */
  SPAM = 'spam',
  /** 不当内容 */
  INAPPROPRIATE_CONTENT = 'inappropriate_content',
  /** 骚扰行为 */
  HARASSMENT = 'harassment',
  /** 版权侵权 */
  COPYRIGHT = 'copyright',
  /** 其他原因 */
  OTHER = 'other',
}
