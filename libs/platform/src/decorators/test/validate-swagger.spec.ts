import type { ArgumentMetadata } from '@nestjs/common'
import { ArrayProperty } from '@libs/platform/decorators/validate/array-property';
import { BitmaskProperty } from '@libs/platform/decorators/validate/bitmask-property';
import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property';
import { DateProperty } from '@libs/platform/decorators/validate/date-property';
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property';
import { JsonProperty } from '@libs/platform/decorators/validate/json-property';
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property';
import { NumberProperty } from '@libs/platform/decorators/validate/number-property';
import { RegexProperty } from '@libs/platform/decorators/validate/regex-property';
import { StringProperty } from '@libs/platform/decorators/validate/string-property';
import { ValidationPipe } from '@nestjs/common'
import { DECORATORS } from '@nestjs/swagger/dist/constants'
import 'reflect-metadata'

enum TestEnum {
  ACTIVE = 'active',
}

enum TestBitmaskEnum {
  READ = 1,
  WRITE = 2,
}

class NestedDto {
  value!: string
}

interface DecoratorFactoryCase {
  name: string
  createDecorator: () => PropertyDecorator
}

function readSwaggerMetadata(createDecorator: () => PropertyDecorator) {
  const decorator = createDecorator()

  class TestDto {
    @decorator
    value!: unknown
  }

  return {
    propertyKeys:
      Reflect.getMetadata(
        DECORATORS.API_MODEL_PROPERTIES_ARRAY,
        TestDto.prototype,
      ) ?? [],
    propertyMetadata: Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      TestDto.prototype,
      'value',
    ),
  }
}

class ContractFilterDto {
  @StringProperty({
    description: '可见字段',
  })
  visible!: string

  @StringProperty({
    description: '内部字段',
    contract: false,
  })
  hidden?: string
}

describe('validate decorators contract metadata', () => {
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    process.env.NODE_ENV = 'development'
  })

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  it.each<DecoratorFactoryCase>([
    {
      name: 'StringProperty',
      createDecorator: () =>
        StringProperty({
          description: '字符串字段',
          contract: false,
        }),
    },
    {
      name: 'NumberProperty',
      createDecorator: () =>
        NumberProperty({
          description: '数字字段',
          contract: false,
        }),
    },
    {
      name: 'ArrayProperty',
      createDecorator: () =>
        ArrayProperty({
          description: '数组字段',
          itemType: 'string',
          contract: false,
        }),
    },
    {
      name: 'BooleanProperty',
      createDecorator: () =>
        BooleanProperty({
          description: '布尔字段',
          contract: false,
        }),
    },
    {
      name: 'DateProperty',
      createDecorator: () =>
        DateProperty({
          description: '日期字段',
          contract: false,
        }),
    },
    {
      name: 'JsonProperty',
      createDecorator: () =>
        JsonProperty({
          description: 'JSON字段',
          contract: false,
        }),
    },
    {
      name: 'RegexProperty',
      createDecorator: () =>
        RegexProperty({
          description: '正则字段',
          regex: /^test$/,
          contract: false,
        }),
    },
    {
      name: 'EnumProperty',
      createDecorator: () =>
        EnumProperty({
          description: '枚举字段',
          enum: TestEnum,
          contract: false,
        }),
    },
    {
      name: 'BitmaskProperty',
      createDecorator: () =>
        BitmaskProperty({
          description: '位掩码字段',
          enum: TestBitmaskEnum,
          contract: false,
        }),
    },
    {
      name: 'NestedProperty',
      createDecorator: () =>
        NestedProperty({
          description: '嵌套字段',
          type: NestedDto,
          contract: false,
        }),
    },
  ])('skips swagger metadata when contract is false for $name', ({
    createDecorator,
  }) => {
    const { propertyKeys, propertyMetadata } = readSwaggerMetadata(
      createDecorator,
    )

    expect(propertyKeys).not.toContain(':value')
    expect(propertyMetadata).toBeUndefined()
  })

  it('keeps swagger metadata enabled by default', () => {
    const { propertyKeys, propertyMetadata } = readSwaggerMetadata(() =>
      StringProperty({
        description: '默认展示字段',
      }),
    )

    expect(propertyKeys).toContain(':value')
    expect(propertyMetadata).toMatchObject({
      description: '默认展示字段',
      required: true,
    })
  })

  it('filters contract=false fields from request payload without throwing', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
    })

    const result = await pipe.transform(
      {
        hidden: 'secret',
        visible: ' visible ',
      },
      {
        metatype: ContractFilterDto,
        type: 'body',
      } as ArgumentMetadata,
    )

    expect(result).toBeInstanceOf(ContractFilterDto)
    expect(result.visible).toBe('visible')
    expect(Object.hasOwn(result, 'hidden')).toBe(false)
  })
})
