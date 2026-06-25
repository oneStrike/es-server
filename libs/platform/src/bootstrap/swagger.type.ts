import type { OpenAPIObject } from '@nestjs/swagger'

export type SwaggerSchemaRecord = NonNullable<
  NonNullable<OpenAPIObject['components']>['schemas']
>
export type SwaggerSchemaOrReference = SwaggerSchemaRecord[string]
export type SwaggerReferenceObject = Extract<
  SwaggerSchemaOrReference,
  { $ref: string }
>
export type SwaggerSchemaObject = Exclude<
  SwaggerSchemaOrReference,
  SwaggerReferenceObject
>
