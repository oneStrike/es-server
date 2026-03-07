/**
 * Unified report status values.
 */
export enum ReportStatusEnum {
  PENDING = 'pending',
  PROCESSING = 'processing',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}

/**
 * Human-readable status labels.
 */
export const ReportStatusNames: Record<ReportStatusEnum, string> = {
  [ReportStatusEnum.PENDING]: '待处理',
  [ReportStatusEnum.PROCESSING]: '处理中',
  [ReportStatusEnum.RESOLVED]: '已处理',
  [ReportStatusEnum.REJECTED]: '已驳回',
}

/**
 * Unified report reason values.
 */
export enum ReportReasonEnum {
  SPAM = 'spam',
  INAPPROPRIATE_CONTENT = 'inappropriate_content',
  HARASSMENT = 'harassment',
  COPYRIGHT = 'copyright',
  OTHER = 'other',
}

/**
 * Human-readable reason labels.
 */
export const ReportReasonNames: Record<ReportReasonEnum, string> = {
  [ReportReasonEnum.SPAM]: '垃圾信息',
  [ReportReasonEnum.INAPPROPRIATE_CONTENT]: '不当内容',
  [ReportReasonEnum.HARASSMENT]: '骚扰行为',
  [ReportReasonEnum.COPYRIGHT]: '版权侵权',
  [ReportReasonEnum.OTHER]: '其他',
}

/**
 * Unified report target types (mapped to user_report.target_type).
 */
export enum ReportTargetTypeEnum {
  COMMENT = 1,
  FORUM_TOPIC = 2,
  FORUM_REPLY = 3,
  USER = 4,
  WORK = 5,
  WORK_CHAPTER = 6,
}

/**
 * Human-readable target labels.
 */
export const ReportTargetTypeNames: Record<ReportTargetTypeEnum, string> = {
  [ReportTargetTypeEnum.COMMENT]: '评论',
  [ReportTargetTypeEnum.FORUM_TOPIC]: '论坛主题',
  [ReportTargetTypeEnum.FORUM_REPLY]: '论坛回复',
  [ReportTargetTypeEnum.USER]: '用户',
  [ReportTargetTypeEnum.WORK]: '作品',
  [ReportTargetTypeEnum.WORK_CHAPTER]: '作品章节',
}
