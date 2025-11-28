import type { ActionTypeEnum } from '@libs/types'
import { SetMetadata } from '@nestjs/common'

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

/**
 * 审计日志装饰器
 * @param metadata 审计日志元数据
 */
export function Audit (metadata?: AuditMetadata) {
  return SetMetadata('audit', metadata || {})
}
