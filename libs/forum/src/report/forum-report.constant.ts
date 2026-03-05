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

// 从 libs/base 重新导出
export { ReportReasonEnum, ReportStatusEnum } from '@libs/base/constant'
