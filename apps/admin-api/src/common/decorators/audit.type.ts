import type { AuditActionTypeEnum } from '@libs/observability/audit/audit-action.constant'
import type { ApiDocOptions } from '@libs/platform/decorators'

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

/** admin-api 审计文档组合装饰器配置，复用平台 ApiDoc 配置并补充审计动作元数据。 */
export type ApiAuditDocOptions<TModel extends object = object> =
  ApiDocOptions<TModel> & {
    audit: Pick<AuditMetadata, 'actionType'> &
      Partial<Pick<AuditMetadata, 'content'>>
  }
