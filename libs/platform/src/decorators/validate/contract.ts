import type { ApiPropertyOptions } from '@nestjs/swagger'
import type { BaseValidateOptions } from './types'
import { isDevelopment } from '@libs/platform/utils/env';
import { ApiHideProperty, ApiProperty } from '@nestjs/swagger'

/**
 * 统一处理 DTO 字段是否属于对外 HTTP 契约。
 *
 * `contract=false` 时，这个字段不会进入 Swagger 文档；
 * 请求阶段的静默过滤由各属性装饰器跳过 class-validator 元数据配合全局 whitelist 完成。
 */
export function buildContractPropertyDecorators(
  options: Pick<BaseValidateOptions, 'contract'>,
  createApiPropertyOptions: () => ApiPropertyOptions,
): PropertyDecorator[] {
  if (options.contract === false) {
    return [ApiHideProperty()]
  }

  if (!isDevelopment()) {
    return []
  }

  return [ApiProperty(createApiPropertyOptions())]
}
