import { StringProperty } from './string-property'
import 'reflect-metadata'

const previousNodeEnv = process.env.NODE_ENV
process.env.NODE_ENV = 'development'

class StringPropertyNullableDto {
  @StringProperty({
    description: '可空字符串',
    required: true,
    nullable: true,
    validation: false,
  })
  value!: string | null
}

describe('stringProperty', () => {
  afterAll(() => {
    process.env.NODE_ENV = previousNodeEnv
  })

  it('prefers explicit nullable over required-derived default', () => {
    const metadata = Reflect.getMetadata(
      'swagger/apiModelProperties',
      StringPropertyNullableDto.prototype,
      'value',
    ) as { required?: boolean, nullable?: boolean } | undefined

    expect(metadata).toMatchObject({
      required: true,
      nullable: true,
    })
  })
})
