import type { ActionTypeEnum } from '../../modules/system/audit/audit.constant'

/**
 * 审计日志装饰器元数据
 */
export interface AuditMetadata {
  /**
   * 操作类型
   */
  actionType: ActionTypeEnum
  /**
   * 自定义内容模板
   */
  content: string
}
