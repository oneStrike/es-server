import type { Type } from '@nestjs/common'
import { applyDecorators } from '@nestjs/common'
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger'
import { ApiSuccessCode } from '../constant'

/**
 * API 文档装饰器配置
 * 用于统一 Swagger 元数据
 *
 * @template TModel 返回模型类型
 */
export interface ApiDocOptions<TModel> {
  /** 接口摘要 */
  summary: string
  /** 返回模型 */
  model?: Type<TModel> | Record<string, any>
  /** 是否返回数组 */
  isArray?: boolean
}

/**
 * HTML 响应文档配置。
 * 用于少数直接返回 text/html、不会经过 JSON envelope 包装的接口。
 */
export interface ApiHtmlDocOptions {
  /** 接口摘要 */
  summary: string
  /** 响应描述 */
  description?: string
  /** HTML 示例 */
  example?: string
}

// 工具函数：判断是否是类
function isClass(model: object): model is Type<object> {
  return typeof model === 'function' && model.prototype
}

// 基础响应结构（不含 data）
function baseResponse(summary: string) {
  return {
    status: 200,
    description: `${summary}成功`,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            code: {
              type: 'number',
              description: '响应状态码',
              example: ApiSuccessCode,
            },
            message: {
              type: 'string',
              description: '响应消息',
              example: 'success',
            },
          },
        },
      },
    },
  }
}

export function ApiDoc<TModel extends Type<object>>(
  options: ApiDocOptions<TModel>,
) {
  const { summary, model, isArray } = options
  let dataSchema
  const response = baseResponse(summary)
  const decorators = [ApiOperation({ summary })]

  if (model) {
    if (isClass(model)) {
      if (model === String) {
        dataSchema = { type: 'string' }
      } else if (model === Number) {
        dataSchema = { type: 'number' }
      } else if (model === Boolean) {
        dataSchema = { type: 'boolean' }
      } else {
        decorators.push(ApiExtraModels(model))
        dataSchema = { $ref: getSchemaPath(model) }
      }
    } else {
      dataSchema = model
    }

    // 如果指定了isArray，则将数据包装成数组形式
    if (isArray) {
      dataSchema = {
        type: 'array',
        items: dataSchema,
      }
    }
  }
  decorators.push(
    ApiResponse({
      ...response,
      content: {
        'application/json': {
          schema: {
            ...response.content['application/json'].schema,
            properties: {
              ...response.content['application/json'].schema.properties,
              ...(dataSchema && { data: dataSchema }),
            },
          },
        },
      },
    }),
  )

  return applyDecorators(...decorators)
}

/**
 * HTML 响应文档装饰器。
 * 保持 ApiDoc 的 JSON envelope 语义，只为 text/html 成功响应提供受控例外。
 */
export function ApiHtmlDoc(options: ApiHtmlDocOptions) {
  const { summary, description = `${summary}成功`, example } = options

  return applyDecorators(
    ApiOperation({ summary }),
    ApiProduces('text/html'),
    ApiOkResponse({
      description,
      content: {
        'text/html': {
          schema: {
            type: 'string',
            ...(example && { example }),
          },
        },
      },
    }),
  )
}

export function ApiPageDoc<TModel extends Type<object>>(
  options: ApiDocOptions<TModel>,
) {
  const { summary, model } = options
  let dataSchema
  const response = baseResponse(summary)
  const decorators = [ApiOperation({ summary })]

  if (model) {
    if (isClass(model)) {
      if (model === String) {
        dataSchema = { type: 'string' }
      } else if (model === Number) {
        dataSchema = { type: 'number' }
      } else if (model === Boolean) {
        dataSchema = { type: 'boolean' }
      } else {
        decorators.push(ApiExtraModels(model))
        dataSchema = { $ref: getSchemaPath(model) }
      }
    } else {
      dataSchema = model
    }
  }

  decorators.push(
    ApiResponse({
      ...response,
      content: {
        'application/json': {
          schema: {
            ...response.content['application/json'].schema,
            properties: {
              ...response.content['application/json'].schema.properties,
              data: {
                type: 'object',
                properties: {
                  pageIndex: {
                    type: 'number',
                    description: '当前页码（从1开始）',
                    required: true,
                    example: 1,
                  },
                  pageSize: {
                    type: 'number',
                    description: '每页条数',
                    required: true,
                    example: 15,
                  },
                  total: {
                    type: 'number',
                    description: '总条数',
                    required: true,
                    example: 100,
                  },
                  ...(dataSchema && {
                    list: {
                      type: 'array',
                      required: true,
                      description: '列表数据',
                      items: dataSchema,
                    },
                  }),
                },
              },
            },
          },
        },
      },
    }),
  )

  return applyDecorators(...decorators)
}
