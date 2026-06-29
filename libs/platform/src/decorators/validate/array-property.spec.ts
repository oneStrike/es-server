import 'reflect-metadata'

import process from 'node:process'
import { validate } from 'class-validator'
import { ArrayProperty } from './array-property'
import { EnumArrayProperty } from './enum-array-property'

const SWAGGER_API_MODEL_PROPERTIES = 'swagger/apiModelProperties'

class ArrayItemDto {
  id!: number
}

enum ArrayStatusEnum {
  ACTIVE = 1,
  INACTIVE = 2,
}

function swaggerPropertyMetadata(target: object, propertyKey: string) {
  return Reflect.getMetadata(
    SWAGGER_API_MODEL_PROPERTIES,
    target,
    propertyKey,
  ) as Record<string, unknown>
}

describe('array contract decorators', () => {
  const originalNodeEnv = process.env.NODE_ENV

  beforeAll(() => {
    process.env.NODE_ENV = 'development'
  })

  afterAll(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = originalNodeEnv
    }
  })

  it('documents nullable DTO arrays when requested', () => {
    class NullableArrayDto {
      @ArrayProperty({
        description: 'Nullable DTO array',
        itemClass: ArrayItemDto,
        nullable: true,
        required: false,
        validation: false,
      })
      items?: ArrayItemDto[] | null
    }

    expect(
      swaggerPropertyMetadata(NullableArrayDto.prototype, 'items'),
    ).toMatchObject({
      isArray: true,
      nullable: true,
      required: false,
      type: ArrayItemDto,
    })
  })

  it('keeps DTO arrays non-nullable by default', () => {
    class NonNullableArrayDto {
      @ArrayProperty({
        description: 'Non-nullable DTO array',
        itemClass: ArrayItemDto,
        required: false,
        validation: false,
      })
      items?: ArrayItemDto[]
    }

    expect(
      swaggerPropertyMetadata(NonNullableArrayDto.prototype, 'items'),
    ).toMatchObject({
      isArray: true,
      nullable: false,
      required: false,
      type: ArrayItemDto,
    })
  })

  it('accepts null for optional nullable DTO arrays', async () => {
    class NullableArrayDto {
      @ArrayProperty({
        description: 'Nullable DTO array',
        itemClass: ArrayItemDto,
        nullable: true,
        required: false,
      })
      items?: ArrayItemDto[] | null
    }

    const dto = new NullableArrayDto()
    dto.items = null

    await expect(validate(dto)).resolves.toEqual([])
  })

  it('documents nullable enum arrays when requested', () => {
    class NullableEnumArrayDto {
      @EnumArrayProperty({
        description: 'Nullable enum array',
        enum: ArrayStatusEnum,
        nullable: true,
        required: false,
        validation: false,
      })
      statuses?: ArrayStatusEnum[] | null
    }

    expect(
      swaggerPropertyMetadata(NullableEnumArrayDto.prototype, 'statuses'),
    ).toMatchObject({
      isArray: true,
      items: {
        enum: [1, 2],
        type: 'number',
      },
      nullable: true,
      required: false,
      type: 'array',
    })
  })
})
