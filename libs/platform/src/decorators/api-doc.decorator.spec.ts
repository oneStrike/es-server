import 'reflect-metadata'
import { StringProperty } from './validate'
import { ApiDoc, ApiHtmlDoc } from './api-doc.decorator'
import { DECORATORS } from '@nestjs/swagger/dist/constants'

class DecoratorSpecDto {
  @StringProperty({
    description: '名称',
    required: true,
  })
  name!: string
}

class DecoratedController {
  @ApiHtmlDoc({
    summary: '协议 HTML 访问页',
    description: '协议 HTML 页面',
    example: '<!doctype html><html lang="zh-CN">...</html>',
  })
  html() {}

  @ApiDoc({
    summary: '布尔响应',
    model: Boolean,
  })
  boolean() {}

  @ApiDoc({
    summary: '字符串响应',
    model: String,
  })
  string() {}

  @ApiDoc({
    summary: '对象响应',
    model: DecoratorSpecDto,
  })
  object() {}
}

function getOperationMetadata(methodName: keyof DecoratedController) {
  return Reflect.getMetadata(
    DECORATORS.API_OPERATION,
    DecoratedController.prototype[methodName],
  ) as { summary?: string } | undefined
}

function getResponseMetadata(methodName: keyof DecoratedController) {
  return Reflect.getMetadata(
    DECORATORS.API_RESPONSE,
    DecoratedController.prototype[methodName],
  ) as
    | Record<
        string,
        {
          description?: string
          content?: Record<
            string,
            {
              schema?: {
                type?: string
                example?: string
                properties?: Record<string, { type?: string; $ref?: string }>
              }
            }
          >
        }
      >
    | undefined
}

describe('api doc decorators', () => {
  it('documents raw html responses through ApiHtmlDoc', () => {
    const operationMetadata = getOperationMetadata('html')
    const responseMetadata = getResponseMetadata('html')
    const htmlResponse = responseMetadata?.['200']

    expect(operationMetadata?.summary).toBe('协议 HTML 访问页')
    expect(htmlResponse?.description).toBe('协议 HTML 页面')
    expect(htmlResponse?.content).toHaveProperty('text/html')
    expect(htmlResponse?.content?.['text/html']?.schema).toMatchObject({
      type: 'string',
      example: '<!doctype html><html lang="zh-CN">...</html>',
    })
  })

  it('keeps boolean ApiDoc responses wrapped in the JSON envelope', () => {
    const responseMetadata = getResponseMetadata('boolean')
    const properties =
      responseMetadata?.['200']?.content?.['application/json']?.schema
        ?.properties

    expect(properties?.code?.type).toBe('number')
    expect(properties?.message?.type).toBe('string')
    expect(properties?.data?.type).toBe('boolean')
  })

  it('keeps string ApiDoc responses wrapped in the JSON envelope', () => {
    const responseMetadata = getResponseMetadata('string')
    const properties =
      responseMetadata?.['200']?.content?.['application/json']?.schema
        ?.properties

    expect(properties?.data?.type).toBe('string')
  })

  it('keeps object ApiDoc responses wrapped in the JSON envelope', () => {
    const responseMetadata = getResponseMetadata('object')
    const properties =
      responseMetadata?.['200']?.content?.['application/json']?.schema
        ?.properties

    expect(properties?.data?.$ref).toContain('DecoratorSpecDto')
  })
})
