import type { ApiAuditDocOptions } from './audit.type'
import { ApiDoc } from '@libs/platform/decorators'
import { applyDecorators } from '@nestjs/common'
import { Audit } from './audit.decorator'

/**
 * admin-api 组合装饰器。
 * 统一复用接口文档摘要作为审计文案，并保留按需覆盖能力。
 */
export function ApiAuditDoc<TModel extends object = object>(
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
