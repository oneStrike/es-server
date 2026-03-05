/**
 * 举报相关常量定义
 * 统一举报状态、类型与原因枚举
 */

/**
 * 举报状态枚举
 * 用于举报记录的处理状态
 * 注意：使用字符串值以兼容现有数据库
 */
export enum ReportStatusEnum {
  /** 待处理 - 举报已提交，等待处理 */
  PENDING = 'pending',
  /** 处理中 - 举报正在处理 */
  PROCESSING = 'processing',
  /** 已解决 - 举报已处理完成 */
  RESOLVED = 'resolved',
  /** 已拒绝 - 举报被驳回 */
  REJECTED = 'rejected',
}

/**
 * 举报状态名称映射
 */
export const ReportStatusNames: Record<ReportStatusEnum, string> = {
  [ReportStatusEnum.PENDING]: '待处理',
  [ReportStatusEnum.PROCESSING]: '处理中',
  [ReportStatusEnum.RESOLVED]: '已解决',
  [ReportStatusEnum.REJECTED]: '已拒绝',
}

/**
 * 举报原因枚举
 * 注意：使用字符串值以兼容现有数据库
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
  /** 其他原因 */
  OTHER = 'other',
}

/**
 * 举报原因名称映射
 */
export const ReportReasonNames: Record<ReportReasonEnum, string> = {
  [ReportReasonEnum.SPAM]: '垃圾信息',
  [ReportReasonEnum.INAPPROPRIATE_CONTENT]: '不当内容',
  [ReportReasonEnum.HARASSMENT]: '骚扰行为',
  [ReportReasonEnum.COPYRIGHT]: '版权侵权',
  [ReportReasonEnum.OTHER]: '其他原因',
}
