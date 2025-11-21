import type { AppSetupConfig } from '@libs/base/nestjs/app.setup'
import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

export function setupSwagger(
  app: INestApplication,
  config?: AppSetupConfig['swaggerConfig'],
) {
  // 👇 创建管理后台文档
  const adminConfig = new DocumentBuilder()
    .setTitle(config?.title || 'API文档')
    .setDescription(config?.description || 'API文档')
    .setVersion(config?.version || '1.0')
    .build()

  const adminDocument = SwaggerModule.createDocument(app, adminConfig, {})

  SwaggerModule.setup(config?.path || 'api-doc', app, adminDocument)
}
