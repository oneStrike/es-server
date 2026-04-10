import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { ArrayProperty } from '../array-property'
import { StringProperty } from '../string-property'

class NestedTagDto {
  @StringProperty({
    description: '标签名',
  })
  name!: string
}

class NumberArrayQueryDto {
  @ArrayProperty({
    description: 'ID 列表',
    itemType: 'number',
    minLength: 1,
  })
  ids!: number[]
}

class RequiredStringArrayDto {
  @ArrayProperty({
    description: '标签列表',
    itemType: 'string',
    required: true,
  })
  tags!: string[]
}

class NestedTagArrayDto {
  @ArrayProperty({
    description: '标签对象列表',
    itemClass: NestedTagDto,
    minLength: 1,
  })
  tags!: NestedTagDto[]
}

describe('array property decorator', () => {
  it('运行时也应拒绝 itemType: object 的旧写法', () => {
    expect(() => {
      class LegacyObjectArrayDto {
        @ArrayProperty({
          description: '旧对象数组写法',
          itemType: 'object' as any,
        } as any)
        items!: Array<Record<string, unknown>>
      }

      return LegacyObjectArrayDto
    }).toThrow('ArrayProperty: 对象数组必须通过 itemClass 定义，不支持 itemType: object')
  })

  it('长度达到最小元素数时应通过校验并完成数字转换', () => {
    const dto = plainToInstance(NumberArrayQueryDto, {
      ids: ['1'],
    })

    const errors = validateSync(dto)

    expect(dto.ids).toEqual([1])
    expect(errors).toHaveLength(0)
  })

  it('必填数组传入空数组时应被拒绝', () => {
    const dto = plainToInstance(RequiredStringArrayDto, {
      tags: [],
    })

    const errors = validateSync(dto)

    expect(errors).toHaveLength(1)
    expect(errors[0]?.constraints).toMatchObject({
      arrayNotEmpty: '数组不能为空',
    })
  })

  it('itemClass 数组在传入对象列表时应触发嵌套校验', () => {
    const dto = plainToInstance(NestedTagArrayDto, {
      tags: [{ name: 123 }],
    })

    const errors = validateSync(dto)

    expect(errors).toHaveLength(1)
    expect(errors[0]?.children).toHaveLength(1)
    expect(errors[0]?.children?.[0]?.children?.[0]?.constraints).toMatchObject({
      isString: '必须是字符串类型',
    })
  })
})
