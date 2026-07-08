import type {
  ApiDocConstructorModel,
  ApiDocOptions,
  ApiHtmlDocOptions,
} from './api-doc.type'
import { applyDecorators } from '@nestjs/common'
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger'
import {
  ApiSuccessCode,
  BusinessErrorCode,
  PlatformErrorCode,
} from '../constant'

// 工具函数：判断是否是类
function isClass(model: object): model is ApiDocConstructorModel {
  return (
    typeof model === 'function' &&
    Boolean((model as { prototype: unknown }).prototype)
  )
}

const ERROR_RESPONSE_EXAMPLES = [
  {
    status: 400,
    code: PlatformErrorCode.BAD_REQUEST,
    message: '请求参数错误',
  },
  {
    status: 401,
    code: PlatformErrorCode.UNAUTHORIZED,
    message: '未登录或登录已失效',
  },
  {
    status: 403,
    code: PlatformErrorCode.FORBIDDEN,
    message: '无权访问',
  },
  {
    status: 404,
    code: BusinessErrorCode.RESOURCE_NOT_FOUND,
    message: '资源不存在',
  },
  {
    status: 409,
    code: BusinessErrorCode.STATE_CONFLICT,
    message: '资源状态冲突',
  },
  {
    status: 422,
    code: PlatformErrorCode.VALIDATION_FAILED,
    message: '数据不符合要求',
  },
  {
    status: 429,
    code: PlatformErrorCode.RATE_LIMITED,
    message: '请求过于频繁',
  },
  {
    status: 500,
    code: PlatformErrorCode.INTERNAL_SERVER_ERROR,
    message: '内部服务器错误',
  },
] as const
const ERROR_RESPONSE_CODE_ENUM: string[] = [
  ...Object.values(PlatformErrorCode),
  ...Object.values(BusinessErrorCode),
]
const EMPTY_DATA_SCHEMA = {
  nullable: true,
  example: null,
}

// 基础响应结构（不含 data）
function baseResponse(summary: string, status = 200) {
  return {
    status,
    description: `${summary}成功`,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              enum: [ApiSuccessCode],
              description: '应用响应码',
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

function errorResponseDecorators() {
  return ERROR_RESPONSE_EXAMPLES.map((example) =>
    ApiResponse({
      status: example.status,
      description: example.message,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['code', 'data', 'message'],
            properties: {
              code: {
                type: 'string',
                enum: ERROR_RESPONSE_CODE_ENUM,
                example: example.code,
              },
              data: {
                nullable: true,
                example: null,
              },
              message: {
                type: 'string',
                example: example.message,
              },
            },
          },
        },
      },
    }),
  )
}

export function ApiDoc<TModel extends object = object>(
  options: ApiDocOptions<TModel>,
) {
  const { summary, model, isArray, nullable, successStatus } = options
  let dataSchema: Record<string, unknown> | undefined
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

    if (nullable) {
      dataSchema =
        dataSchema.$ref !== undefined
          ? { allOf: [dataSchema], nullable: true }
          : { ...dataSchema, nullable: true }
    }
  }
  return ((target, propertyKey, descriptor) => {
    const response = baseResponse(summary, successStatus ?? 200)
    applyDecorators(
      ...decorators,
      ApiResponse({
        ...response,
        content: {
          'application/json': {
            schema: {
              ...response.content['application/json'].schema,
              properties: {
                ...response.content['application/json'].schema.properties,
                data: dataSchema ?? EMPTY_DATA_SCHEMA,
              },
            },
          },
        },
      }),
      ...errorResponseDecorators(),
    )(target, propertyKey, descriptor)
  }) as MethodDecorator
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

export function ApiPageDoc<TModel extends object = object>(
  options: ApiDocOptions<TModel>,
) {
  const { summary, model, successStatus } = options
  let dataSchema: Record<string, unknown> | undefined
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

  return ((target, propertyKey, descriptor) => {
    const response = baseResponse(summary, successStatus ?? 200)
    applyDecorators(
      ...decorators,
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
                      example: 1,
                    },
                    pageSize: {
                      type: 'number',
                      description: '每页条数',
                      example: 15,
                    },
                    total: {
                      type: 'number',
                      description: '总条数',
                      example: 100,
                    },
                    ...(dataSchema && {
                      list: {
                        type: 'array',
                        description: '列表数据',
                        items: dataSchema,
                      },
                    }),
                  },
                  required: dataSchema
                    ? ['pageIndex', 'pageSize', 'total', 'list']
                    : ['pageIndex', 'pageSize', 'total'],
                },
              },
            },
          },
        },
      }),
      ...errorResponseDecorators(),
    )(target, propertyKey, descriptor)
  }) as MethodDecorator
}
