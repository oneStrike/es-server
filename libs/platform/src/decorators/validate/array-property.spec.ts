import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { ArrayProperty } from './array-property'
import 'reflect-metadata'

enum NumericEnum {
  ONE = 1,
  TWO = 2,
}

enum StringEnum {
  COMMENT = 'comment',
  TOPIC = 'topic',
}

class NumericEnumArrayDto {
  @ArrayProperty({
    description: '数字枚举数组',
    itemEnum: NumericEnum,
    example: [NumericEnum.ONE],
  })
  values!: NumericEnum[]
}

class StringEnumArrayDto {
  @ArrayProperty({
    description: '字符串枚举数组',
    itemEnum: StringEnum,
    example: [StringEnum.COMMENT],
  })
  values!: StringEnum[]
}

describe('arrayProperty itemEnum', () => {
  it('normalizes numeric enum array values from strings', () => {
    const dto = plainToInstance(NumericEnumArrayDto, {
      values: ['1', '2'],
    })

    expect(dto.values).toEqual([1, 2])
    expect(validateSync(dto)).toHaveLength(0)
  })

  it('keeps string enum array values and validates them', () => {
    const dto = plainToInstance(StringEnumArrayDto, {
      values: ['comment', 'topic'],
    })

    expect(dto.values).toEqual(['comment', 'topic'])
    expect(validateSync(dto)).toHaveLength(0)
  })

  it('rejects invalid enum array items', () => {
    const dto = plainToInstance(NumericEnumArrayDto, {
      values: ['1', '999'],
    })

    const errors = validateSync(dto)
    expect(errors).toHaveLength(1)
    expect(errors[0]?.constraints).toBeDefined()
  })
})
