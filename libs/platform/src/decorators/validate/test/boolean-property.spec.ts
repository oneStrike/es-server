import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { BooleanProperty } from '../boolean-property'

class BooleanDto {
  @BooleanProperty({
    description: '布尔值',
  })
  flag!: boolean
}

describe('boolean property decorator', () => {
  it('应把 0 和 1 转换为布尔值', () => {
    const falseDto = plainToInstance(BooleanDto, { flag: 0 })
    const trueDto = plainToInstance(BooleanDto, { flag: 1 })

    expect(falseDto.flag).toBe(false)
    expect(validateSync(falseDto)).toHaveLength(0)
    expect(trueDto.flag).toBe(true)
    expect(validateSync(trueDto)).toHaveLength(0)
  })

  it('不应把 2 这类非法数字静默转换为 true', () => {
    const dto = plainToInstance(BooleanDto, { flag: 2 })

    const errors = validateSync(dto)

    expect(dto.flag).toBe(2)
    expect(errors).toHaveLength(1)
    expect(errors[0]?.constraints).toMatchObject({
      isBoolean: '必须是布尔类型',
    })
  })
})
