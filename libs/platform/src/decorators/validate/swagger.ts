import type { ApiPropertyOptions } from '@nestjs/swagger'
import type { BaseValidateOptions } from './types'
import { isDevelopment } from '@libs/platform/utils'
import { ApiHideProperty, ApiProperty } from '@nestjs/swagger'

/**
 * 统一处理 DTO 字段的 Swagger 装饰器输出。
 *
 * 当字段显式关闭 Swagger 文档时，保留 ApiHideProperty 以兼容未来可能启用的 Swagger 插件；
 * 其他情况继续沿用仓库现有行为，仅在开发环境写入 ApiProperty 元数据。
 */
export function buildSwaggerPropertyDecorators(
  options: Pick<BaseValidateOptions, 'swagger'>,
  createApiPropertyOptions: () => ApiPropertyOptions,
): PropertyDecorator[] {
  if (options.swagger === false) {
    return [ApiHideProperty()]
  }

  if (!isDevelopment()) {
    return []
  }

  return [ApiProperty(createApiPropertyOptions())]
}
