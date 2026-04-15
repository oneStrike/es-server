import type { ApiPropertyOptions } from '@nestjs/swagger'
import type { ObjectPropertyOptions } from './types'
import { applyDecorators } from '@nestjs/common'
import { Transform } from 'class-transformer'
import { IsObject, IsOptional } from 'class-validator'
import { buildContractPropertyDecorators } from './contract'

/**
 * 开放对象属性装饰器。
 * 用于声明 shape 未收敛的 JSON 对象契约，不会把对象转成字符串。
 */
export function ObjectProperty(options: ObjectPropertyOptions) {
  const inContract = options.contract ?? true
  const validation = inContract && (options.validation ?? true)
  const decorators: PropertyDecorator[] = []

  if (validation) {
    decorators.push(IsObject({ message: '必须是对象类型' }))

    if (!(options.required ?? true)) {
      decorators.push(IsOptional())
    }

    decorators.push(
      Transform(({ value }) => {
        if (
          (value === undefined || value === null) &&
          options.default !== undefined
        ) {
          return options.default
        }

        return value
      }),
    )

    if (options.transform) {
      decorators.push(Transform(options.transform))
    }
  }

  decorators.push(
    ...buildContractPropertyDecorators(options, () => {
      const apiPropertyOptions: ApiPropertyOptions = {
        description: options.description,
        example: options.example,
        required: options.required ?? true,
        default: options.default,
        nullable: options.nullable ?? !(options.required ?? true),
        type: Object,
        additionalProperties: true,
      }

      return apiPropertyOptions
    }),
  )

  return applyDecorators(...decorators)
}
