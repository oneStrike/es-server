import type { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'

/**
 * 审计日志装饰器元数据
 */
export interface AuditMetadata {
  /**
   * 操作类型
   */
  actionType: AuditActionTypeEnum
  /**
   * 自定义内容模板
   */
  content: string
}
