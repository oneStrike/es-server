/**
 * 举报相关常量定义
 * 统一举报状态、原因和目标类型枚举
 */

/**
 * 举报处理状态
 */
export enum ReportStatusEnum {
  /** 待处理 */
  PENDING = 'pending',
  /** 处理中 */
  PROCESSING = 'processing',
  /** 已处理 */
  RESOLVED = 'resolved',
  /** 已驳回 */
  REJECTED = 'rejected',
}

/**
 * 举报状态显示名称
 */
export const ReportStatusNames: Record<ReportStatusEnum, string> = {
  [ReportStatusEnum.PENDING]: '待处理',
  [ReportStatusEnum.PROCESSING]: '处理中',
  [ReportStatusEnum.RESOLVED]: '已处理',
  [ReportStatusEnum.REJECTED]: '已驳回',
}

/**
 * 举报原因
 */
export enum ReportReasonEnum {
  /** 垃圾信息 */
  SPAM = 'spam',
  /** 不当内容 */
  INAPPROPRIATE_CONTENT = 'inappropriate_content',
  /** 骚扰行为 */
  HARASSMENT = 'harassment',
  /** 版权侵权 */
  COPYRIGHT = 'copyright',
  /** 其他 */
  OTHER = 'other',
}

/**
 * 举报原因显示名称
 */
export const ReportReasonNames: Record<ReportReasonEnum, string> = {
  [ReportReasonEnum.SPAM]: '垃圾信息',
  [ReportReasonEnum.INAPPROPRIATE_CONTENT]: '不当内容',
  [ReportReasonEnum.HARASSMENT]: '骚扰行为',
  [ReportReasonEnum.COPYRIGHT]: '版权侵权',
  [ReportReasonEnum.OTHER]: '其他',
}

/**
 * 举报目标类型
 * 对应 user_report.target_type
 */
export enum ReportTargetTypeEnum {
  /** 评论 */
  COMMENT = 1,
  /** 论坛主题 */
  FORUM_TOPIC = 2,
  /** 论坛回复 */
  FORUM_REPLY = 3,
  /** 用户 */
  USER = 4,
}

/**
 * 举报目标类型显示名称
 */
export const ReportTargetTypeNames: Record<ReportTargetTypeEnum, string> = {
  [ReportTargetTypeEnum.COMMENT]: '评论',
  [ReportTargetTypeEnum.FORUM_TOPIC]: '论坛主题',
  [ReportTargetTypeEnum.FORUM_REPLY]: '论坛回复',
  [ReportTargetTypeEnum.USER]: '用户',
}
