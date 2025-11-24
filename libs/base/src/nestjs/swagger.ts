import type { AppConfigInterface } from '@libs/types'
import type { INestApplication } from '@nestjs/common'

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

export function setupSwagger(
  app: INestApplication,
  config: AppConfigInterface['swaggerConfig'],
) {
  // 👇 创建管理后台文档
  const adminConfig = new DocumentBuilder()
    .setTitle(config.title)
    .setDescription(config.description)
    .setVersion(config.version)
    .build()

  const adminDocument = SwaggerModule.createDocument(app, adminConfig, {})
  SwaggerModule.setup(config.path, app, adminDocument)
}
