import type { AuditMetadata } from './audit.types'
import { SetMetadata } from '@nestjs/common'

/**
 * 审计日志装饰器
 * @param metadata 审计日志元数 据
 */
export function Audit(metadata?: AuditMetadata) {
  return SetMetadata('audit', metadata || {})
}
