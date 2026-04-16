import type { ApiDocOptions } from '@libs/platform/decorators/api-doc.decorator'
import type { Type } from '@nestjs/common'
import type { AuditMetadata } from './audit.types'
import { ApiDoc } from '@libs/platform/decorators/api-doc.decorator'
import { applyDecorators } from '@nestjs/common'
import { Audit } from './audit.decorator'

export interface ApiAuditDocOptions<TModel> extends ApiDocOptions<TModel> {
  audit: Pick<AuditMetadata, 'actionType'> & Partial<Pick<AuditMetadata, 'content'>>
}

/**
 * admin-api 组合装饰器。
 * 统一复用接口文档摘要作为审计文案，并保留按需覆盖能力。
 */
export function ApiAuditDoc<TModel extends Type<object>>(
  options: ApiAuditDocOptions<TModel>,
) {
  const { audit, ...apiDocOptions } = options

  return applyDecorators(
    ApiDoc(apiDocOptions),
    Audit({
      actionType: audit.actionType,
      content: audit.content ?? apiDocOptions.summary,
    }),
  )
}
