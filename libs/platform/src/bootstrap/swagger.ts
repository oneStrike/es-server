import type { AppConfigInterface } from '@libs/platform/types'
import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

/**
 * 配置 Swagger API 文档
 *
 * 根据 config 构建并挂载 Swagger 文档页面。
 * 生产环境默认不启用，仅当 isDevelopment 或 config.enable 为 true 时生效。
 *
 * @param app - NestJS 应用实例
 * @param config - Swagger 配置项，包含 title、description、version、path
 */
export function setupSwagger(
  app: INestApplication,
  config: AppConfigInterface['swaggerConfig'],
) {
  const adminConfig = new DocumentBuilder()
    .setTitle(config.title)
    .setDescription(config.description)
    .setVersion(config.version)
    .build()

  const adminDocument = SwaggerModule.createDocument(app, adminConfig, {})
  SwaggerModule.setup(config.path, app, adminDocument)
}
