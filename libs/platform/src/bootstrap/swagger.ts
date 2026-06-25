import type { AppConfigInterface } from '@libs/platform/types'
import type { INestApplication } from '@nestjs/common'
import type { OpenAPIObject } from '@nestjs/swagger'
import type {
  SwaggerReferenceObject,
  SwaggerSchemaObject,
  SwaggerSchemaOrReference,
} from './swagger.type'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

function isReferenceObject(
  schema: SwaggerSchemaOrReference,
): schema is SwaggerReferenceObject {
  return '$ref' in schema
}

function hasSingleReferenceAllOf(
  allOf: SwaggerSchemaObject['allOf'],
): allOf is [SwaggerReferenceObject] {
  return (
    Array.isArray(allOf) &&
    allOf.length === 1 &&
    typeof allOf[0] === 'object' &&
    allOf[0] !== null &&
    '$ref' in allOf[0] &&
    typeof allOf[0].$ref === 'string'
  )
}

function normalizeNullableReferenceProperty(
  property: SwaggerSchemaOrReference,
): SwaggerSchemaOrReference {
  if (isReferenceObject(property)) {
    return property
  }

  if (property.nullable !== true || !hasSingleReferenceAllOf(property.allOf)) {
    return property
  }

  const { allOf, type, ...restProperty } = property

  return {
    $ref: allOf[0].$ref,
    ...restProperty,
    nullable: true,
  }
}

export function normalizeNullableReferenceSchemas(
  document: OpenAPIObject,
): OpenAPIObject {
  const schemas = document.components?.schemas

  if (!schemas) {
    return document
  }

  for (const schema of Object.values(schemas)) {
    if (isReferenceObject(schema) || !schema.properties) {
      continue
    }

    for (const [propertyName, property] of Object.entries(schema.properties)) {
      schema.properties[propertyName] = normalizeNullableReferenceProperty(
        property,
      )
    }
  }

  return document
}

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

  const adminDocument = normalizeNullableReferenceSchemas(
    SwaggerModule.createDocument(app, adminConfig, {}),
  )
  SwaggerModule.setup(config.path, app, adminDocument)
}
